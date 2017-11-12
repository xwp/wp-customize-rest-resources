=== Customize REST Resources ===
Contributors: westonruter, xwp
Requires at least: 4.7
Tested up to: 4.9
Stable tag: trunk
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires PHP: 5.3

Edit any resource fetched from the WP REST API in the Customizer, with fields automatically constructed from the schema.

== Description ==

*See the [Bridging the Customizer and the WP REST API](https://make.xwp.co/2016/01/06/bridging-the-customizer-and-the-wp-rest-api/) introductory post.*

The WP REST API provides a rich machine-readable interface for programmatically making changes to WordPress. The changes made, however, cannot be previewed. The customizer (Customize API) is WordPress's framework for live previewing any change, and this can include changes made to REST resources. And this is what this plugin implements. The REST endpoints provide a uniform abstraction layer on top of a diverse array of WordPress API calls. Implementing customizer settings for all of WordPress's object types would require creating a new `WP_Customize_Setting` subclass for each with unique implementations for the `update`, `value`, `sanitize`, and `preview` methods. With the REST API, however, we have a uniform input (request) and output (response) interface that a single customizer setting can be implemented to interact with. Each REST resource is represented by the same customizer setting type. Since each endpoint (should) provide a schema for describing what the resources at those endpoints look like, the customizer can read from this schema to `sanitize` and validate the REST resource prior to being sent along for `update`. Implementing `preview` for a REST resource involves filtering the REST Server response.

With the REST API providing a schema for a given resource, we also have the ability to automatically generate the controls for this resource with fields that have the appropriate control types (dropdowns, checkboxes, etc) and value types (boolean, integer, string, etc).

When the WP API JS client is used, where REST resources are encapsulated in Backbone models, this plugin will opt-in the relevant REST resource setting for `postMessage` transport. Assuming that the JS app is developed in a way where the view will be re-rendered in response to model changes, when the customizer syncs a setting for a REST resource into the preview, the model will likewise be updated when the setting is changed in the preview, resulting in a live preview of a JS application in the customizer without any full-page refresh or even selective refresh ([#27355](https://core.trac.wordpress.org/ticket/27355)).

This plugin leverages the new [Customize Changesets](https://make.wordpress.org/core/2016/10/12/customize-changesets-formerly-transactions-merge-proposal/) feature in 4.7 in that Ajax requests made to the REST API in the customizer preview will have customizations applied in their responses.

The Customize REST Resources plugin is closely related to [A more RESTful WP-CLI](https://www.kickstarter.com/projects/danielbachhuber/a-more-restful-wp-cli/description) which seeks to “unlock the potential of the WP REST API at the command line” in that “all WP REST API endpoints registered via plugins and themes will _automagically_ be usable as WP-CLI commands”. In the same way, Customize REST Resources begins to unlock the potential of the WP REST API in the _customizer_ by automatically creating settings and controls for all REST resources that are used on a given page. In this way, **anything developed for the REST API should automatically be available in the customizer**.

Note that the customizer setting applies the customizations to preview by adding a `rest_post_dispatch` filter. So if you are making internal requests in PHP to perhaps provide [bootstrapped data](http://backbonejs.org/#FAQ-bootstrap) to Backbone, you need to ensure that you apply this filter in addition to just calling `dispatch`. For example:

<pre lang="php">
<?php
$request = new \WP_REST_Request( 'GET', "/wp/v2/posts/1" );
$response = rest_get_server()->dispatch( $request );
/** This filter is documented in wp-includes/rest-api/class-wp-rest-server.php */
$post_response = apply_filters( 'rest_post_dispatch', $response, rest_get_server(), $request ); // Required for customize preview.
</pre>

Here's a quick demo of an alpha state of this plugin when used with the [Next Recent Posts](https://github.com/xwp/wp-next-recent-posts-widget) widget:

[youtube https://youtu.be/d3QMA9Zkwok]

== Limitations ==

* Changes made to REST resources will not be synced to other “native” settings in the customizer. For example, if you have the Customize Posts plugin there will be panels and sections added for all of the posts/pages that appear in the preview. If you modify a `post` or `postmeta` setting as added by Customize Posts, the changes there will not sync into the corresponding `rest_resource` setting. Likewise, if you modify a `rest_resource` setting for a `post` resource, the changes won't sync into the `post`/`postmeta` settings as added by Customize Posts. In other words, this plugin allows for changes to be modified in more than one place and a bridge between the settings is not implemented as this Customize REST Resources plugin is primarily a proof of concept.
* Responses to JSONP requests to the WP REST API will be ignored since they cannot be intercepted in Ajax requests using `jQuery.prefilter`.
* REST resources can only be customized if they are served by the WordPress site being previewed. As such, customizing headless WordPress-driven sites is not yet supported.
* Fields that have `raw` and `rendered` properties will be exposed as a single input tied to the `raw` property. Modifying the `raw` will supply the `raw` value to the `rendered` property. In the future, there should be an Ajax request which applies the rendering logic to the `raw` value so that it can be previewed properly.
* Only existing REST resources can be customized. It is not yet possible to create new resources in the customizer.

== Screenshots ==

1. REST resources used in preview are added as controls in the REST Resources panel.
2. Fields in the REST resource control are created from the schema.
3. New REST resources fetched via Ajax are automatically added to the REST Resources panel.
4. JS apps using the WP API Backbone client get live preview `postMessage` updates.
