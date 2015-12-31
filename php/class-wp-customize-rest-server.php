<?php
/**
 * Customize WP_REST_Server
 *
 * @package CustomizeRESTResources
 */

namespace CustomizeRESTResources;

/**
 * Customize WP_REST_Server class.
 */
class WP_Customize_REST_Server extends \WP_REST_Server {

	/**
	 * Converts a response to data to send.
	 *
	 * @param \WP_REST_Response $response Response object.
	 * @param bool              $embed    Whether links should be embedded.
	 *
	 * @return array {
	 *     Data with sub-requests embedded.
	 *
	 *     @type array [$_links]    Links.
	 *     @type array [$_embedded] Embeddeds.
	 * }
	 */
	public function response_to_data( $response, $embed ) {
		$data = parent::response_to_data( $response, $embed );
		$server = $this;

		/**
		 * Filter return value for \CustomizeRESTResources\WP_Customize_REST_Server::response_to_data()
		 *
		 * @param array $data Data.
		 * @param array $args {
		 *     Filter args.
		 *
		 *     @type \WP_REST_Server   $server   The server.
		 *     @type \WP_REST_Response $response The response.
		 *     @type bool              $embed    Whether to embed.
		 * }
		 */
		$data = apply_filters( 'customize_rest_server_response_data', $data, compact( 'server', 'response', 'embed' ) );
		return $data;
	}
}
