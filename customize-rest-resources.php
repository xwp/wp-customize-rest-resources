<?php
/**
 * Plugin Name: Customize REST Resources
 * Plugin URI: https://github.com/xwp/wp-customize-rest-resources
 * Description: Edit any resource fetched from the WP REST API in the Customizer, with fields automatically constructed from the schema.
 * Version: 0.1
 * Author:  XWP
 * Author URI: https://xwp.co/
 * License: GPLv2+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: customize-rest-resources
 * Domain Path: /languages
 *
 * Copyright (c) 2015 XWP (https://xwp.co/)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2 or, at
 * your discretion, any later version, as published by the Free
 * Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 *
 * @package CustomizeRESTResources
 */

if ( version_compare( phpversion(), '5.3', '>=' ) ) {
	require_once __DIR__ . '/instance.php';
} else {
	if ( defined( 'WP_CLI' ) ) {
		WP_CLI::warning( _customize_rest_resources_php_version_text() );
	} else {
		add_action( 'admin_notices', '_customize_rest_resources_php_version_error' );
	}
}

/**
 * Admin notice for incompatible versions of PHP.
 */
function _customize_rest_resources_php_version_error() {
	printf( '<div class="error"><p>%s</p></div>', esc_html( _customize_rest_resources_php_version_text() ) );
}

/**
 * String describing the minimum PHP version.
 *
 * @return string
 */
function _customize_rest_resources_php_version_text() {
	return __( 'Customize REST Resources plugin error: Your version of PHP is too old to run this plugin. You must be running PHP 5.3 or higher.', 'customize-rest-resources' );
}
