<?php
/**
 * Test_Customize_REST_Resources
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Class Test_Customize_REST_Resources
 *
 * @package CustomizeRESTResources
 */
class Test_Customize_REST_Resources extends \WP_UnitTestCase {

	/**
	 * Test _customize_rest_resources_php_version_error().
	 *
	 * @see _customize_rest_resources_php_version_error()
	 */
	public function test_customize_rest_resources_php_version_error() {
		ob_start();
		_customize_rest_resources_php_version_error();
		$buffer = ob_get_clean();
		$this->assertContains( '<div class="error">', $buffer );
	}

	/**
	 * Test _customize_rest_resources_php_version_text().
	 *
	 * @see _customize_rest_resources_php_version_text()
	 */
	public function test_customize_rest_resources_php_version_text() {
		$this->assertContains( 'Customize REST Resources plugin error:', _customize_rest_resources_php_version_text() );
	}
}
