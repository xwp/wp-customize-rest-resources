<?php
/**
 * REST Resource Customizer Setting
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Class WP_Customize_REST_Resource_Setting
 *
 * @package CustomizeRESTResources
 */
class WP_Customize_REST_Resource_Setting extends \WP_Customize_Setting {

	const TYPE = 'rest_resource';

	/**
	 * Plugin instance.
	 *
	 * @var Plugin
	 */
	public $plugin;

	/**
	 * Type of setting.
	 *
	 * @access public
	 * @var string
	 */
	public $type = self::TYPE;

	/**
	 * Route for this setting.
	 *
	 * @var string
	 */
	public $route;

	/**
	 * Previewed settings by route.
	 *
	 * @var WP_Customize_REST_Resource_Setting[]
	 */
	static public $previewed_routes = array();

	/**
	 * WP_Customize_REST_Resource_Setting constructor.
	 *
	 * @param \WP_Customize_Manager $manager Manager.
	 * @param string                $id      Setting ID.
	 * @param array                 $args    Setting args.
	 * @throws Exception If the ID is in an invalid format.
	 */
	public function __construct( $manager, $id, $args = array() ) {
		if ( ! isset( $args['sanitize_callback'] ) ) {
			$args['sanitize_callback'] = array( $this, 'sanitize' );
		}
		if ( ! preg_match( '#^rest_resource\[(?P<route>.+?)]$#', $id, $matches ) ) {
			throw new Exception( 'Illegal setting id: ' . $id );
		}
		$this->route = trim( $matches['route'], '/' );
		if ( ! isset( $args['plugin'] ) || ! ( $args['plugin'] instanceof Plugin ) ) {
			throw new Exception( sprintf( 'Missing plugin arg for %s', get_class( $this ) ) );
		}
		parent::__construct( $manager, $id, $args );
	}

	/**
	 * Flag this setting as one to be previewed.
	 *
	 * @return bool
	 */
	public function preview() {
		$callback = array( __CLASS__, 'filter_rest_post_dispatch' );
		if ( ! has_filter( 'rest_post_dispatch', $callback ) ) {
			add_filter( 'rest_post_dispatch', $callback, 20, 3 );
		}
		$callback = array( __CLASS__, 'filter_customize_rest_server_response_data' );
		if ( ! has_filter( 'customize_rest_server_response_data', $callback ) ) {
			add_filter( 'customize_rest_server_response_data', $callback );
		}
		static::$previewed_routes[ $this->route ] = $this;
		$this->is_previewed = true;
		return true;
	}

	/**
	 * Sanitize (and validate) an input.
	 *
	 * @param string $value   The value to sanitize.
	 * @param bool   $strict  Whether validation is being done. This is part of the proposed patch in in #34893.
	 * @return string|array|null Null if an input isn't valid, otherwise the sanitized value.
	 */
	public function sanitize( $value, $strict = false ) {
		unset( $setting );

		// The customize_validate_settings action is part of the Customize Setting Validation plugin.
		if ( ! $strict && doing_action( 'customize_validate_settings' ) ) {
			$strict = true;
		}

		$route = '/' . ltrim( $this->route, '/' );
		$request = new \WP_REST_Request( 'PUT', $route );
		$request->set_body( $value );

		$validity_errors = new \WP_Error();

		/**
		 * Make sure the upgraded edit-context request is obtained so we can access the necessary args.
		 *
		 * @see \CustomizeRESTResources\Plugin::use_edit_context_for_requests()
		 *
		 * @param $dispatch_result
		 * @param \WP_REST_Request $dispatched_request
		 *
		 * @return bool
		 */
		$intercept_request_dispatch = function ( $dispatch_result, \WP_REST_Request $dispatched_request ) use ( &$request ) {
			unset( $dispatch_result );
			$request = $dispatched_request;
			return false;
		};

		add_filter( 'rest_dispatch_request', $intercept_request_dispatch, 10, 2 );
		$this->plugin->get_rest_server()->dispatch( $request );
		remove_filter( 'rest_dispatch_request', $intercept_request_dispatch );

		$data = json_decode( $request->get_body(), true );
		unset( $data['_embedded'] );
		$attributes = $request->get_attributes();
		if ( ! isset( $attributes['args'] ) ) {
			trigger_error( "Unable to gather args for $this->id", E_USER_WARNING ); // WPCS: XSS OK.
			return null;
		}
		$args = $attributes['args'];
		foreach ( array_keys( $data ) as $key ) {
			if ( ! isset( $args[ $key ] ) || ! isset( $data[ $key ] ) ) {
				continue;
			}
			$value = $data[ $key ];
			if ( isset( $args[ $key ]['sanitize_callback'] ) ) {
				$value = call_user_func( $args[ $key ]['sanitize_callback'], $value, $request, $key );
			}
			if ( $strict && isset( $args[ $key ]['validate_callback'] ) ) {
				$validity = call_user_func( $args[ $key ]['validate_callback'], $value, $request, $key );
				if ( is_wp_error( $validity ) ) {
					foreach ( $validity->errors as $code => $message ) {
						$validity_errors->add( $code, $message, $validity->get_error_data( $code ) );
					}
				}
			}
			$data[ $key ] = $value;
		}

		if ( count( $validity_errors->errors ) > 0 ) {
			return $validity_errors;
		}

		return wp_json_encode( $data );
	}

	/**
	 * Filter the API response to inject the Customized REST resources.
	 *
	 * @param array $data Data.
	 * @return array Filtered data.
	 */
	static public function filter_customize_rest_server_response_data( $data ) {
		if ( isset( $data['_links'] ) ) {
			$data = static::filter_single_resource( $data );
		} else if ( isset( $data[0] ) ) {
			$data = array_map(
				function( $item ) {
					return static::filter_single_resource( $item );
				},
				$data
			);
		}
		return $data;
	}

	/**
	 * Fallback filter the API response to inject the Customized REST resources.
	 *
	 * This filter cannot apply on embedded resources since they get injected
	 * after the rest_post_dispatch filter is called. For this reason, it serves
	 * as a fallback if the customize_rest_server_response_data filter can't be
	 * used in our WP_REST_Server subclass.
	 *
	 * @param \WP_HTTP_Response $result  Result to send to the client. Usually a \WP_REST_Response.
	 * @param \WP_REST_Server   $server  Server instance.
	 * @param \WP_REST_Request  $request Request used to generate the response.
	 * @return \WP_REST_Response
	 */
	static public function filter_rest_post_dispatch( $result, $server, $request ) {
		// Skip filtering on rest_post_dispatch if our server subclass is used.
		if ( $server instanceof WP_Customize_REST_Server ) {
			return $result;
		}

		unset( $request );
		$data = $result->get_data();

		$links = null;
		if ( $result instanceof \WP_REST_Response ) {
			$links = $result->get_links();
		}

		if ( ! empty( $links ) ) {
			$data = static::filter_single_resource( $data, $links );
		} else if ( isset( $data[0] ) ) {
			$data = array_map(
				array( __CLASS__, 'filter_single_resource' ),
				$data
			);
		}

		$result->set_data( $data );
		return $result;
	}

	/**
	 * Filter single resource.
	 *
	 * @param array $resource Resource.
	 * @param array $links    Links.
	 *
	 * @return array Filtered resource.
	 * @throws Exception When unexpected condition occurs.
	 */
	static public function filter_single_resource( $resource, $links = null ) {

		if ( empty( $links ) && isset( $resource['_links'] ) ) {
			$links = $resource['_links'];
		}
		if ( ! isset( $links['self'][0]['href'] ) ) {
			return $resource;
		}

		$self_href = $links['self'][0]['href'];
		$base_rest_url = rest_url();
		if ( strpos( $self_href, $base_rest_url ) !== 0 ) {
			throw new Exception( "Unable to locate $base_rest_url in $self_href" );
		}

		$route = substr( $self_href, strlen( $base_rest_url ) );

		if ( ! isset( static::$previewed_routes[ $route ] ) ) {
			return $resource;
		}
		$setting = static::$previewed_routes[ $route ];
		$value = $setting->post_value();
		if ( null !== $value && ! is_wp_error( $value ) ) {
			$resource = json_decode( $value, true );
		}

		// Apply preview to embedded resources.
		if ( isset( $resource['_embedded'] ) ) {
			foreach ( $resource['_embedded'] as &$embeddeds ) {
				foreach ( $embeddeds as &$embedded ) {
					$embedded = static::filter_single_resource( $embedded );
				}
			}
		}

		return $resource;
	}

	/**
	 * Get the default value according to the schema.
	 *
	 * Note that this is used instead of setting the $default property in the
	 * constructor since it requires computation to obtain, and it will only
	 * be used in the uncommon case where there is no saved value nor any post value.
	 *
	 * @throws Exception If the schema request failed.
	 * @return string JSON default value.
	 */
	public function get_default() {
		$rest_server = $this->plugin->get_rest_server();
		$rest_request = new \WP_REST_Request( 'OPTIONS', '/' . $this->route );
		$rest_response = $rest_server->dispatch( $rest_request );
		if ( $rest_response->is_error() ) {
			throw new Exception( $rest_response->as_error()->get_error_message() );
		}
		$default = null;
		$data = $rest_response->get_data();
		if ( ! empty( $data['schema'] ) ) {
			$default = $this->get_field_default_value( $data['schema'] );
		}

		return wp_json_encode( $default );
	}

	/**
	 * Get the default value recursively from a multidimensional field schema.
	 *
	 * @param array $field Field properties.
	 * @return mixed
	 */
	protected function get_field_default_value( $field ) {
		if ( isset( $field['properties'] ) ) {
			$value = array();
			foreach ( $field['properties'] as $property_name => $sub_properties ) {
				$value[ $property_name ] = $this->get_field_default_value( $sub_properties );
			}
		} else if ( isset( $field['default'] ) ) {
			$value = $field['default'];
		} else {
			// @todo Try to provide default values based on type?
			$value = null;
		}
		return $value;
	}

	/**
	 * Return REST resource setting's JSON.
	 *
	 * @return string JSON.
	 */
	public function value() {
		$value = null;
		if ( $this->is_previewed ) {
			$value = $this->post_value();
		}
		if ( ! $value ) {
			$rest_server = $this->plugin->get_rest_server();
			$route = '/' . ltrim( $this->route, '/' );
			$rest_request = new \WP_REST_Request( 'GET', $route );
			$rest_response = $rest_server->dispatch( $rest_request );
			if ( ! $rest_response->is_error() ) {
				$value = wp_json_encode( $rest_server->response_to_data( $rest_response, false ) );
			}
		}
		if ( ! $value ) {
			$value = $this->get_default();
		}
		return $value;
	}

	/**
	 * Save the value of the setting.
	 *
	 * @param string $value The value to update.
	 *
	 * @return bool The result of saving the value.
	 */
	protected function update( $value ) {
		$wp_rest_server = $this->plugin->get_rest_server();
		$route = '/' . ltrim( $this->route, '/' );
		$rest_request = new \WP_REST_Request( 'PUT', $route );
		$rest_request->set_header( 'content-type', 'application/json' );
		$rest_request->set_body( $value );
		$rest_response = $wp_rest_server->dispatch( $rest_request );

		if ( $rest_response->is_error() ) {
			add_filter( 'customize_save_response', function ( $response ) use ( $rest_response ) {
				if ( ! isset( $response['customize_rest_resources_save_errors'] ) ) {
					$response['customize_rest_resources_save_errors'] = array();
				}
				$response['customize_rest_resources_save_errors'][ $this->id ] = $rest_response->as_error()->get_error_message();
				return $response;
			} );
			return false;
		}
		return true;
	}
}
