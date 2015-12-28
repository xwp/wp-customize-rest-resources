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
	public function __construct( $manager, $id, $args ) {
		parent::__construct( $manager, $id, $args );
		if ( ! preg_match( '#^rest_resource\[(?P<route>.+?)]$#', $id, $matches ) ) {
			throw new Exception( 'Illegal setting id: ' . $id );
		}
		$this->route = $matches['route'];
	}

	/**
	 * Flag this setting as one to be previewed.
	 */
	public function preview() {
		$callback = array( __CLASS__, 'filter_rest_post_dispatch' );
		if ( ! has_filter( 'rest_post_dispatch', $callback ) ) {
			add_filter( 'rest_post_dispatch', array( __CLASS__, 'filter_rest_post_dispatch' ), 10, 3 );
		}
		static::$previewed_routes[ $this->route ] = $this;
		return true;
	}


	/**
	 * Sanitize an input.
	 *
	 * @param string|array $value The value to sanitize.
	 * @return string|array|null Null if an input isn't valid, otherwise the sanitized value.
	 */
	public function sanitize( $value ) {
		// @todo This is going to be passed in as JSON string. We should instead get passed an array.
		// @todo use \WP_REST_Controller::get_item_schema()
		return $value;
	}

	/**
	 * Filter the API response.
	 *
	 * Allows modification of the response before returning.
	 *
	 * @param \WP_HTTP_Response $result  Result to send to the client. Usually a WP_REST_Response.
	 * @param \WP_REST_Server   $server  Server instance.
	 * @param \WP_REST_Request  $request Request used to generate the response.
	 * @return \WP_REST_Response
	 */
	static public function filter_rest_post_dispatch( $result, $server, $request ) {
		unset( $server, $request ); // @todo Should we be looking at this?
		$data = $result->get_data();

		if ( isset( $data['_links'] ) ) {
			$data = static::filter_single_resource( $data );
		} else {
			$data = array_map(
				array( __CLASS__, 'filter_single_resource' ), // @todo Should this be static?
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
	 *
	 * @return array Filtered resource.
	 * @throws Exception When unexpected condition occurs.
	 */
	static public function filter_single_resource( $resource ) {
		if ( ! isset( $resource['_links']['self'][0]['href'] ) ) {
			return $resource;
		}

		$self_href = $resource['_links']['self'][0]['href'];
		$base_rest_url = rest_url();
		if ( strpos( $self_href, $base_rest_url ) !== 0 ) {
			throw new Exception( "Unable to locate $base_rest_url in $self_href" );
		}

		$route = substr( $self_href, strlen( $base_rest_url ) );

		if ( ! isset( static::$previewed_routes[ $route ] ) ) {
			return $resource;
		}
		$setting = static::$previewed_routes[ $route ];
		$post_value = $setting->post_value();
		if ( null !== $post_value ) {
			// @todo We should pass around JSON objects not JSON strings. Running sanitize on a JSON string is not ideal.
			$resource = json_decode( $post_value, true );
		}
		return $resource;
	}

	/**
	 * @todo Implement this to get the value from the REST API plugin.
	 */
	public function value() {
		return '{TODO}';
		return parent::value();
	}

}
