<?php
/**
 * REST Resources Customizer Section
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Class WP_Customize_REST_Resources_Section
 *
 * @package CustomizeRESTResources
 */
class WP_Customize_REST_Resources_Section extends \WP_Customize_Section {

	const TYPE = 'rest_resources';

	/**
	 * Type of control, used by JS.
	 *
	 * @access public
	 * @var string
	 */
	public $type = self::TYPE;

	/**
	 * Export data to JS.
	 *
	 * @return array
	 */
	public function json() {
		$data = parent::json();
		$data['noResourcesLoadedMessage'] = __( 'There are no REST API resources yet queried via the WP API JS client in the preview.', 'customize-rest-resources' );
		return $data;
	}
}
