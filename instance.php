<?php
/**
 * Instantiates the Customize REST Resources plugin
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

global $customize_rest_resources_plugin;

require_once __DIR__ . '/php/class-plugin-base.php';
require_once __DIR__ . '/php/class-plugin.php';

$customize_rest_resources_plugin = new Plugin();

/**
 * Customize REST Resources Plugin Instance
 *
 * @return Plugin
 */
function get_plugin_instance() {
	global $customize_rest_resources_plugin;
	return $customize_rest_resources_plugin;
}
