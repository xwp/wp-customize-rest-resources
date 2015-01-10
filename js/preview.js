/* global wp, jQuery, console, _wpCustomizeRestResourcesPreviewExports */
wp.customize.RestResources.preview = (function( $, wp, restResources, console ) {

	var self = {
		dirtySettings: [],
		theme: '',
		nonce: '',
		active: $.Deferred()
	};

	if ( 'undefined' !== typeof _wpCustomizeRestResourcesPreviewExports ) {
		$.extend( self, _wpCustomizeRestResourcesPreviewExports );
	}

	/**
	 * @see wp.customize.Previewer.query()
	 *
	 * @returns {{}}
	 */
	self.getCustomizedQueryVars = function() {
		var customized = {};
		_.each( self.dirtySettings, function( settingId ) {
			if ( wp.customize.has( settingId ) ) {
				customized[ settingId ] = wp.customize( settingId ).get();
			}
		} );
		return {
			wp_customize: 'on',
			theme: self.theme,
			customized: customized,
			nonce: self.nonce
		};
	};

	/**
	 * Send each loaded resource to the Customizer for creation as a rest setting.
	 *
	 * @param event
	 * @param xhr
	 * @param options
	 * @param data
	 */
	self.ajaxSuccess = function( event, xhr, options, data ) {
		var resources;
		if ( 0 !== options.url.indexOf( restResources.apiSettings.root ) ) {
			return;
		}
		if ( _.isArray( data ) ) {
			resources = data.slice();
		} else {
			resources = [ data ];
		}

		self.active.done( function() {
			_.each( resources, function( resource ) {
				wp.customize.preview.send( 'previewedRestResource', resource );
			} );
		} );
	};

	self.receiveSetting = function ( args ) {
		var id = args[0],
			value = args[1],
			matches;

		matches = id.match( /^rest_resource\[(.+?)]/ );
		if ( matches ) {
			console.info( matches[1], value );
		}

		// @todo Now we need to figure out which collection contains this resource, and then update it in place.
	};

	wp.customize.bind( 'preview-ready', function() {

		// @todo Redirect all API writes into messages sent to the wp.customize.preview

		wp.customize.preview.bind( 'setting', self.receiveSetting );

		// Inject persistent query vars into the Ajax request data
		$.ajaxPrefilter( 'json', restResources.ajaxPrefilter );

		// Keep track of which settings are dirty.
		wp.customize.preview.bind( 'dirtySetting', function( settingId ) {
			if ( -1 === self.dirtySettings.indexOf( settingId ) ) {
				self.dirtySettings.push( settingId );
			}
		} );
		wp.customize.preview.bind( 'dirtySettings', function( settingIds ) {
			self.dirtySettings = settingIds;
		} );

		wp.customize.preview.bind( 'active', function() {
			self.active.resolve();
		} );

		$( document ).ajaxSuccess( self.ajaxSuccess );
	} );

	return self;
}( jQuery, wp, wp.customize.RestResources, console ) ); // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
