/* global CustomizeRestResources, wp, JSON, console */

/**
 * Rest Resource Pane Manager.
 *
 * @class
 */
CustomizeRestResources.RestResourcesPaneManager = CustomizeRestResources.RestResourcesManager.extend({

	/**
	 * Initialize.
	 *
	 * @param args
	 */
	initialize: function( args ) {
		var manager = this;
		CustomizeRestResources.RestResourcesManager.prototype.initialize.call( manager, args );
		manager.schema = args.schema || {};

		manager.timezoneOffsetString = args.timezoneOffsetString || 'Z';
		manager.l10n = args.l10n;

		wp.customize.sectionConstructor.rest_resources = CustomizeRestResources.RestResourcesSection;
		wp.customize.controlConstructor.rest_resource = CustomizeRestResources.RestResourceControl;

		wp.customize.bind( 'ready', function() {
			wp.customize.previewer.bind( 'rest-resource-previewed', function( resource ) {
				if ( _.isString( resource ) ) {
					resource = JSON.parse( resource );
				}
				manager.ensureSetting( resource );
			} );
			wp.customize.previewer.bind( 'rest-resource-setting-postmessage-transport-eligible', _.bind( manager.setPostMessageTransport, manager ) );
			wp.customize.bind( 'saved', _.bind( manager.handleSaveErrors, manager ) ) ;
		});

		// @todo Core should handle this automatically in the controls pane just as it is done in the preview.
		jQuery.ajaxPrefilter( 'json', _.bind( manager.prefilterAjax, manager ) );
	},

	/**
	 * Send the setting to tha Customizer pane when it is created in the preview.
	 *
	 * Create and add the setting for a given REST Resource.
	 *
	 * @param {object} resource
	 * @returns {wp.customize.Setting|null}
	 */
	ensureSetting: function( resource ) {
		var manager = this, setting, customizeId;
		setting = CustomizeRestResources.RestResourcesManager.prototype.ensureSetting.call( manager, resource );
		customizeId = setting.id;

		if ( ! wp.customize.control.has( customizeId ) ) {
			wp.customize.control.add( customizeId, new CustomizeRestResources.RestResourceControl( customizeId, {
				params: {
					settings: {
						'default': setting.id
					},
					section: 'rest_resources',
					priority: wp.customize.section( 'rest_resources' ).controls().length + 1
				}
			} ) );
		}

		return setting;
	},

	/**
	 * Set postMessage transport for the supplied setting ID.
	 *
	 * By default settings get created with refresh transport. Only when JS model
	 * model is initialized that uses the resource will the setting opt-in to
	 * postMessage, since the Backbone model initialization signals that we are
	 * able to sync the model changes back into the initialized JS model. By
	 * default only WP-API Backbone models are supported, but other JS models
	 * can be supported by sending rest-resource-setting-postmessage-transport-eligible
	 * messages from the preview (via the preview manager's notifySettingPostMessageTransportEligible method).
	 *
	 * @param {string} settingId
	 */
	setPostMessageTransport: function( settingId ) {
		wp.customize( settingId, function( setting ) {
			setting.transport = 'postMessage';
		} );
	},

	/**
	 * Handle setting save errors that made it through the sanitization/validation checks.
	 *
	 * @param {object} response
	 * @param {object} [response.customize_rest_resources_save_errors]
	 */
	handleSaveErrors: function( response ) {
		if ( ! response.customize_rest_resources_save_errors ) {
			return;
		}
		_.each( response.customize_rest_resources_save_errors, function( errorMessage, settingId ) {
			var setting = wp.customize( settingId );
			if ( ! setting ) {
				return;
			}
			if ( setting.validationMessage ) {
				setting.validationMessage.set( errorMessage );
			}
		} );
	},

	/**
	 * Rewrite WP API Ajax requests to inject Customizer state.
	 *
	 * @todo This is done in the preview automatically.
	 *
	 * @param {object} options
	 * @param {string} options.type
	 * @param {string} options.url
	 * @param {object} originalOptions
	 * @param {object} xhr
	 */
	prefilterAjax: function( options, originalOptions, xhr ) {
		var manager = this, restMethod;

		// Abort if not API request or Customizer preview not initialized yet.
		if ( 0 !== options.url.indexOf( manager.restApiRoot ) ) {
			return;
		}

		restMethod = options.type.toUpperCase();

		if ( 'GET' !== restMethod && 'HEAD' !== restMethod && 'undefined' !== typeof console.warn ) {
			throw new Error( 'Attempted ' + restMethod + ' request for ' + options.url + ' when in Customizer. Write interception is not yet implemented.' );
		}

		// Customizer currently requires POST requests, so use override (force Backbone.emulateHTTP).
		if ( 'POST' !== restMethod ) {
			xhr.setRequestHeader( 'X-HTTP-Method-Override', restMethod );
			options.type = 'POST';
		}

		// Eliminate context param because we will be adding edit context.
		if ( ! options.data ) {
			options.data = '';
		}

		if ( options.data && 'GET' === restMethod ) {
			/*
			 * Make sure the query vars for the REST API persist in GET (since
			 * REST API explicitly look at $_GET['filter']).
			 * We have to make sure the REST query vars are added as GET params
			 * when the method is GET as otherwise they won't be parsed properly.
			 * The issue lies in \WP_REST_Request::get_parameter_order() which
			 * only is looking at \WP_REST_Request::$method instead of $_SERVER['REQUEST_METHOD'].
			 * @todo Improve \WP_REST_Request::get_parameter_order() to be more aware of X-HTTP-Method-Override
			 */
			if ( options.url.indexOf( '?' ) === -1 ) {
				options.url += '?';
			} else {
				options.url += '&';
			}
			options.url += options.data;
		}

		// Add Customizer post data.
		if ( options.data ) {
			options.data += '&';
		}
		options.data += jQuery.param( wp.customize.previewer.query() );
	}
});
