<?php
/**
 * Tests for Plugin_Base.
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Tests for Plugin_Base.
 *
 * @package CustomizeRESTResources
 */
class Test_Plugin_Base extends \WP_UnitTestCase {

	/**
	 * Plugin instance.
	 *
	 * @var Plugin
	 */
	public $plugin;

	/**
	 * Setup.
	 *
	 * @inheritdoc
	 */
	public function setUp() {
		parent::setUp();
		$this->plugin = get_plugin_instance();
	}

	/**
	 * Test locate_plugin.
	 *
	 * @see Plugin_Base::locate_plugin()
	 */
	public function test_locate_plugin() {
		$location = $this->plugin->locate_plugin();
		$this->assertEquals( 'customize-rest-resources', $location['dir_basename'] );
		$this->assertContains( 'plugins/customize-rest-resources', $location['dir_path'] );
		$this->assertContains( 'plugins/customize-rest-resources', $location['dir_url'] );
	}

	/**
	 * Tests for trigger_warning().
	 *
	 * @see Plugin_Base::trigger_warning()
	 */
	public function test_trigger_warning() {
		$obj = $this;
		set_error_handler( function ( $errno, $errstr ) use ( $obj ) {
			$obj->assertEquals( 'CustomizeRESTResources\Plugin: Param is 0!', $errstr );
			$obj->assertEquals( \E_USER_WARNING, $errno );
		} );
		$this->plugin->trigger_warning( 'Param is 0!', \E_USER_WARNING );
		restore_error_handler();
	}

	/**
	 * Test is_wpcom_vip_prod().
	 *
	 * @see Plugin_Base::is_wpcom_vip_prod()
	 */
	public function test_is_wpcom_vip_prod() {
		if ( ! defined( 'WPCOM_IS_VIP_ENV' ) ) {
			$this->assertFalse( $this->plugin->is_wpcom_vip_prod() );
			define( 'WPCOM_IS_VIP_ENV', true );
		}
		$this->assertEquals( WPCOM_IS_VIP_ENV, $this->plugin->is_wpcom_vip_prod() );
	}
}
