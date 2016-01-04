<?php
/**
 * REST Resource Customizer Control
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Class WP_Customize_REST_Resource_Control
 *
 * @package CustomizeRESTResources
 */
class WP_Customize_REST_Resource_Control extends \WP_Customize_Control {

	const TYPE = 'rest_resource';

	/**
	 * Type of control, used by JS.
	 *
	 * @access public
	 * @var string
	 */
	public $type = self::TYPE;

	/**
	 * No-op since we're using JS template.
	 *
	 * @since 4.3.0
	 * @access protected
	 */
	protected function render_content() {}

	/**
	 * Render the Underscore template for this control.
	 *
	 * @since 4.3.0
	 * @access protected
	 */
	protected function content_template() {
		?>
		<details>
			<summary class="customize-control-title"><code>{{ data.label }}</code></summary>
			<div class="elements-container"></div>
			<div class="customize-setting-validation-message error" aria-live="assertive"></div>
		</details>
		<?php
	}
}
