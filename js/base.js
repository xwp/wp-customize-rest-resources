wp.customize.RestResources = (function( $, wp, apiSettings ) {

	var self = {
		apiSettings: apiSettings
	};

	if ( 'undefined' === typeof self.apiSettings ) {
		throw new Error( 'WP_API_Settings is not defined' );
	}
	if ( 'undefined' !== typeof _customizeRestResourcesExports ) {
		_.extend( self, _customizeRestResourcesExports );
	}

	/**
	 * Extend a WP API Backbone model to integrate with the Customizer.
	 *
	 * @param {Backbone.Model} model
	 */
	self.customizeModel = function ( model ) {

	};

	/**
	 * Extend a WP API Backbone collection to integrate with the Customizer.
	 *
	 * @param {Backbone.Collection} collection
	 */
	self.customizeCollection = function ( collection ) {
		var oldInitialize = collection.prototype.initialize;
		collection.prototype.initialize = function () {
			var collection = this;
			oldInitialize.apply( collection, arguments );
			collection.on( 'add', function( model, collection, options ) {
				console.info( 'added', model );
				// @todo Make sure that
			} );

		};
	};

	// @todo add mixins for wp.api.models and wp.api.collections
	// @todo make sure that this gets enqueued after all scripts that depend on wp-api

	_.each( wp.api.models, function( model ) {
		//self.customizeModel( model );
	} );

	_.each( wp.api.collections, function( collection ) {
		//self.customizeCollection( collection );
	} );

	/**
	 * Rewrite WP API Ajax requests to inject Customizer state.
	 *
	 * @todo This can be in base??
	 *
	 * @param {object} options
	 * @param {string} options.type
	 * @param {string} options.url
	 * @param {object} originalOptions
	 * @param {object} xhr
	 */
	self.ajaxPrefilter = function( options, originalOptions, xhr ) {

		// Abort if not API request or Customizer preview not initialized yet.
		if ( 0 !== options.url.indexOf( self.apiSettings.root ) ) {
			return;
		}

		if ( 'GET' !== options.type && 'HEAD' !== options.type && 'undefined' !== typeof console.warn ) {
			console.warn( 'Performing write request to WP API in Customizer.' );
		}

		// Customizer currently requires POST requests, so use override (force Backbone.emulateHTTP).
		if ( 'POST' !== options.type ) {
			xhr.setRequestHeader( 'X-HTTP-Method-Override', options.type );
			options.type = 'POST';
		}

		// Include Customizer preview data.
		if ( options.data ) {
			options.data += '&';
		}

		if ( self.preview ) {
			options.data += $.param( self.preview.getCustomizedQueryVars() );
		} else if ( self.controls ) {
			options.data += $.param( wp.customize.previewer.query() );
		}

	};

	return self;
}( jQuery, wp, WP_API_Settings ) ); // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
