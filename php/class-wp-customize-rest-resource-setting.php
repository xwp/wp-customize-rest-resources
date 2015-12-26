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
	 * @todo Implement this to add filter to the REST API plugin.
	 */
	public function preview() {
		return parent::preview();
	}

	/**
	 * @todo Implement this to get the value from the REST API plugin.
	 */
	public function value() {
		return '{TODO}';
		return parent::value();
	}

}
