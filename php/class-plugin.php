<?php
/**
 * Bootstraps the Customize REST Resources plugin.
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Main plugin bootstrap file.
 */
class Plugin extends Plugin_Base {

	/**
	 * Class constructor.
	 */
	public function __construct() {
		$this->plugin_file = dirname( __DIR__ ) . '/customize-rest-resources.php';

		parent::__construct();

		$priority = 9; // Because WP_Customize_Widgets::register_settings() happens at after_setup_theme priority 10.
		add_action( 'after_setup_theme', array( $this, 'init' ), $priority );
	}

	/**
	 * Initiate the plugin resources.
	 *
	 * @action after_setup_theme
	 */
	public function init() {
		if ( ! function_exists( 'get_rest_url' ) || ! apply_filters( 'rest_enabled', true ) ) {
			add_action( 'admin_notices', array( $this, 'show_missing_rest_api_admin_notice' ) );
			return;
		}

		$this->config = apply_filters( 'customize_rest_resources_plugin_config', $this->config, $this );

		add_action( 'wp_default_scripts', array( $this, 'register_scripts' ), 11 );
		add_action( 'wp_default_styles', array( $this, 'register_styles' ), 11 );

		add_action( 'customize_controls_enqueue_scripts', array( $this, 'enqueue_customize_controls_scripts' ) );
		add_action( 'customize_preview_init', array( $this, 'customize_preview_init' ) );

		add_action( 'customize_register', array( $this, 'customize_register' ), 20 );
		add_action( 'customize_dynamic_setting_args', array( $this, 'filter_dynamic_setting_args' ), 10, 2 );
		add_action( 'customize_dynamic_setting_class', array( $this, 'filter_dynamic_setting_class' ), 10, 3 );
		add_action( 'rest_api_init', array( $this, 'remove_customize_signature' ) );

		add_action( 'customize_controls_print_footer_scripts', array( $this, 'print_templates' ) );
	}

	/**
	 * Show error when REST API is not available.
	 *
	 * @action admin_notices
	 */
	public function show_missing_rest_api_admin_notice() {
		?>
		<div class="error">
			<p><?php esc_html_e( 'The Customize REST Resources plugin requires the WordPress REST API to be available and enabled.', 'customize-rest-resources' ); ?></p>
		</div>
		<?php
	}

	/**
	 * Register scripts.
	 *
	 * @param \WP_Scripts $wp_scripts Instance of \WP_Scripts.
	 * @action wp_default_scripts
	 */
	public function register_scripts( \WP_Scripts $wp_scripts ) {
		$handle = 'customize-rest-resources-namespace';
		$src = $this->dir_url . 'js/namespace.js';
		$deps = array();
		$wp_scripts->add( $handle, $src, $deps, $this->version );

		$handle = 'customize-rest-resources-manager';
		$src = $this->dir_url . 'js/rest-resources-manager.js';
		$deps = array(
			'customize-rest-resources-namespace',
			'wp-api',
			'backbone',
		);
		$wp_scripts->add( $handle, $src, $deps, $this->version );

		$handle = 'customize-rest-resources-pane-manager';
		$src = $this->dir_url . 'js/rest-resources-pane-manager.js';
		$deps = array(
			'customize-rest-resources-namespace',
			'customize-rest-resources-manager',
			'customize-controls',
			'customize-rest-resources-section',
			'customize-rest-resource-control',
		);
		$wp_scripts->add( $handle, $src, $deps, $this->version );

		$handle = 'customize-rest-resources-preview-manager';
		$src = $this->dir_url . 'js/rest-resources-preview-manager.js';
		$deps = array(
			'customize-rest-resources-namespace',
			'customize-rest-resources-manager',
			'customize-preview',
		);
		$wp_scripts->add( $handle, $src, $deps, $this->version );

		$handle = 'customize-rest-resources-section';
		$src = $this->dir_url . 'js/rest-resources-section.js';
		$deps = array(
			'customize-rest-resources-namespace',
			'customize-controls',
		);
		$wp_scripts->add( $handle, $src, $deps, $this->version );

		$handle = 'customize-rest-resource-control';
		$src = $this->dir_url . 'js/rest-resource-control.js';
		$deps = array(
			'customize-rest-resources-namespace',
			'customize-controls',
		);
		$wp_scripts->add( $handle, $src, $deps, $this->version );
	}

	/**
	 * Register styles.
	 *
	 * @param \WP_Styles $wp_styles Instance of \WP_Styles.
	 * @action wp_default_styles
	 */
	public function register_styles( \WP_Styles $wp_styles ) {
		$handle = 'customize-rest-resources-pane';
		$src = $this->dir_url . 'css/customize-pane.css';
		$deps = array( 'customize-controls' );
		$wp_styles->add( $handle, $src, $deps, $this->version );
	}

	/**
	 * Enqueue scripts for Customizer pane.
	 *
	 * @action customize_controls_enqueue_scripts
	 */
	public function enqueue_customize_controls_scripts() {
		wp_enqueue_style( 'customize-rest-resources-pane' );
		wp_enqueue_script( 'customize-rest-resources-pane-manager' );
		add_action( 'customize_controls_print_footer_scripts', array( $this, 'boot_pane_script' ), 100 );
	}

	/**
	 * Boot script for Customizer pane.
	 *
	 * @action customize_controls_print_footer_scripts
	 */
	public function boot_pane_script() {
		global $wp_customize;
		wp_print_scripts( array( 'customize-rest-resources-pane-manager' ) );

		$args = array(
			'previewedTheme' => $wp_customize->get_stylesheet(),
			'previewNonce' => wp_create_nonce( 'preview-customize_' . $wp_customize->get_stylesheet() ),
			'restApiRoot' => get_rest_url(),
		);
		?>
		<script>
		/* global CustomizeRestResources */
		CustomizeRestResources.manager = new CustomizeRestResources.RestResourcesPaneManager( <?php echo wp_json_encode( $args ) ?> );
		</script>
		<?php
	}

	/**
	 * Setup Customizer preview.
	 *
	 * @action customize_preview_init
	 */
	public function customize_preview_init() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_customize_preview_scripts' ) );
	}

	/**
	 * Enqueue scripts for Customizer preview.
	 *
	 * @action wp_enqueue_scripts
	 */
	public function enqueue_customize_preview_scripts() {
		wp_enqueue_script( 'customize-rest-resources-preview-manager' );
		add_action( 'wp_print_footer_scripts', array( $this, 'boot_preview_script' ), 100 );
	}

	/**
	 * Boot script for Customizer preview.
	 *
	 * @action wp_print_footer_scripts
	 */
	public function boot_preview_script() {
		global $wp_customize;
		wp_print_scripts( array( 'customize-rest-resources-preview-manager' ) );

		$dirty_setting_values = array();
		foreach ( array_keys( $wp_customize->unsanitized_post_values() ) as $setting_id ) {
			if ( ! preg_match( '#^rest_resource\[#', $setting_id ) ) {
				continue;
			}
			$setting = $wp_customize->get_setting( $setting_id );
			if ( $setting ) {
				$dirty_setting_values[ $setting_id ] = $setting->value();
			}
		}

		$args = array(
			'previewedTheme' => $wp_customize->get_stylesheet(),
			'previewNonce' => wp_create_nonce( 'preview-customize_' . $wp_customize->get_stylesheet() ),
			'restApiRoot' => get_rest_url(),
			'initialDirtySettingValues' => $dirty_setting_values,
		);
		?>
		<script>
		/* global CustomizeRestResources */
		CustomizeRestResources.manager = new CustomizeRestResources.RestResourcesPreviewManager( <?php echo wp_json_encode( $args ) ?> );
		</script>
		<?php
	}


	/**
	 * Register section and controls for REST resources.
	 *
	 * Note that this needs to happen at a priority greater than 11 for
	 * customize_register so that dynamic settings will have been registered via
	 * {@see \WP_Customize_Manager::register_dynamic_settings}.
	 *
	 * @param \WP_Customize_Manager $wp_customize Manager.
	 */
	public function customize_register( \WP_Customize_Manager $wp_customize ) {
		$wp_customize->register_control_type( __NAMESPACE__ . '\\WP_Customize_REST_Resource_Control' );
		$section_id = 'rest_resources';
		$section = new WP_Customize_REST_Resources_Section( $wp_customize, $section_id, array(
			'title' => __( 'REST Resources', 'customize-rest-resources' ),
		) );
		$wp_customize->add_section( $section );

		$i = 0;
		foreach ( $wp_customize->settings() as $setting ) {
			$needs_rest_control = (
				$setting instanceof WP_Customize_REST_Resource_Setting
				&&
				! $wp_customize->get_control( $setting->id )
			);
			if ( $needs_rest_control ) {
				$control = new WP_Customize_REST_Resource_Control( $wp_customize, $setting->id, array(
					'section' => $section_id,
					'settings' => $setting->id,
					'priority' => $i,
				) );
				$wp_customize->add_control( $control );
				$i += 1;
			}
		}
	}

	/**
	 * Filter a dynamically-created rest_resource setting's args.
	 *
	 * For a dynamic setting to be registered, this filter must be employed
	 * to override the default false value with an array of args to pass to
	 * the WP_Customize_Setting constructor.
	 *
	 * @param false|array $setting_args The arguments to the WP_Customize_Setting constructor.
	 * @param string      $setting_id   ID for dynamic setting, usually coming from `$_POST['customized']`.
	 * @return array Setting args.
	 */
	public function filter_dynamic_setting_args( $setting_args, $setting_id ) {
		if ( preg_match( '#^rest_resource\[(?P<route>.*?)\]#', $setting_id ) ) {
			$setting_args['type'] = WP_Customize_REST_Resource_Setting::TYPE;
			$setting_args['transport'] = 'postMessage';
		}
		return $setting_args;
	}

	/**
	 * Filter a dynamically-created rest_resource setting's class.
	 *
	 * @param string $setting_class WP_Customize_Setting or a subclass.
	 * @param string $setting_id    ID for dynamic setting, usually coming from `$_POST['customized']`.
	 * @param array  $setting_args  WP_Customize_Setting or a subclass.
	 * @return string Setting class.
	 */
	public function filter_dynamic_setting_class( $setting_class, $setting_id, $setting_args ) {
		unset( $setting_id );
		if ( isset( $setting_args['type'] ) && WP_Customize_REST_Resource_Setting::TYPE === $setting_args['type'] ) {
			$setting_class = __NAMESPACE__ . '\\WP_Customize_REST_Resource_Setting';
		}
		return $setting_class;
	}

	/**
	 * Print templates for controls.
	 *
	 * @action customize_controls_print_footer_scripts
	 */
	public function print_templates() {
		?>
		<script id="tmpl-customize-rest-resources-section-notice" type="text/html">
			<div class="customize-rest-resources-section-notice">
				<em>{{ data.message }}</em>
			</div>
		</script>
		<?php
	}

	/**
	 * Remove the Customizer preview signature during REST API requests since it corrupts the JSON.
	 *
	 * @action rest_api_init
	 */
	public function remove_customize_signature() {
		global $wp_customize;
		if ( ! is_customize_preview() || empty( $wp_customize ) ) {
			return;
		}
		$wp_customize->remove_preview_signature();
	}
}
