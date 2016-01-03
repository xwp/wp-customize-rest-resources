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
	 * Request that is initialized when sanitizing.
	 *
	 * @see WP_Customize_REST_Resource_Setting::sanitize()
	 *
	 * @var \WP_REST_Request
	 */
	public $request;

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
		if ( ! isset( $args['plugin'] ) || ! ( $args['plugin'] instanceof Plugin ) ) {
			throw new Exception( sprintf( 'Missing plugin arg for %s', get_class( $this ) ) );
		}
		parent::__construct( $manager, $id, $args );
		if ( ! preg_match( '#^rest_resource\[(?P<route>.+?)]$#', $id, $matches ) ) {
			throw new Exception( 'Illegal setting id: ' . $id );
		}
		$this->route = trim( $matches['route'], '/' );
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
	 * Get instance of WP_REST_Server.
	 *
	 * @todo This should be part of Core.
	 *
	 * @return \WP_REST_Server
	 */
	public function get_rest_server() {
		/**
		 * REST Server.
		 *
		 * @var \WP_REST_Server $wp_rest_server
		 */
		global $wp_rest_server;
		if ( empty( $wp_rest_server ) ) {
			/** This filter is documented in wp-includes/rest-api.php */
			$wp_rest_server_class = apply_filters( 'wp_rest_server_class', 'WP_REST_Server' );
			$wp_rest_server = new $wp_rest_server_class();

			/** This filter is documented in wp-includes/rest-api.php */
			do_action( 'rest_api_init', $wp_rest_server );
		}
		return $wp_rest_server;
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
		$this->request = new \WP_REST_Request( 'PUT', $route );
		$this->request->set_body( $value );

		$validity_errors = new \WP_Error();

		add_filter( 'rest_dispatch_request', '__return_false' );
		$this->get_rest_server()->dispatch( $this->request );
		remove_filter( 'rest_dispatch_request', '__return_false' );

		$data = json_decode( $this->request->get_body(), true );
		$attributes = $this->request->get_attributes();
		$args = $attributes['args'];
		foreach ( array_keys( $data ) as $key ) {
			if ( ! isset( $args[ $key ] ) || ! isset( $data[ $key ] ) ) {
				continue;
			}
			$value = $data[ $key ];
			if ( isset( $args[ $key ]['sanitize_callback'] ) ) {
				$value = call_user_func( $args[ $key ]['sanitize_callback'], $value, $this->request, $key );
			}
			if ( $strict && isset( $args[ $key ]['validate_callback'] ) ) {
				$validity = call_user_func( $args[ $key ]['validate_callback'], $value, $this->request, $key );
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
	 * Return value for setting.
	 *
	 * Note that this is currently only returning the sanitized value for any
	 * any setting that is dirty. There shouldn't be any REST Resource settings
	 * registered via PHP that are not dirty. Non-dirty settings are registered
	 * dynamically via JS.
	 *
	 * @todo Implement returning the underlying item value when it is not dirty.
	 * @todo Strip out embedded from being included?
	 *
	 * @return string|null JSON or null if item is not previewed.
	 */
	public function value() {
		if ( isset( $this->updated_value ) ) {
			return $this->updated_value;
		} else {
			return $this->post_value();
		}
	}

	/**
	 * Saved response from update.
	 *
	 * @todo This is temporarily needed until value() implements the dispatching of the GET request.
	 *
	 * @see \CustomizeRESTResources\WP_Customize_REST_Resource_Setting::update()
	 *
	 * @var string
	 */
	protected $updated_value;

	/**
	 * Save the value of the setting.
	 *
	 * @param string $value The value to update.
	 *
	 * @return bool The result of saving the value.
	 */
	protected function update( $value ) {
		$wp_rest_server = $this->get_rest_server();
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
			} );
			return false;
		} else {
			$this->updated_value = wp_json_encode( $rest_response->get_data() );
			return true;
		}
	}
}
