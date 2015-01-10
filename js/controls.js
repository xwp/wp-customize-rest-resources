/* global wp, jQuery, console, JSON, _customizeRestResourcesControlsExports */
wp.customize.RestResources.controls = (function( $, wp, restResources ) {

	var self = {
		l10n: {
			noResourcesLoadedMessage: ''
		}
	};

	if ( 'undefined' !== typeof _customizeRestResourcesControlsExports ) {
		$.extend( self, _customizeRestResourcesControlsExports );
	}

	/**
	 * Notify the preview of a dirty setting.
	 *
	 * @param {wp.customize.Setting} setting
	 */
	self.notifyDirtySetting = function( setting ) {
		if ( setting._dirty ) {
			wp.customize.previewer.send( 'dirtySetting', setting.id );
		}
	};

	/**
	 * Notify preview of all dirty settings.
	 */
	self.notifyDirtySettings = function() {
		var dirtySettingIds = [];
		wp.customize.each( function( value, key ) {
			if ( value._dirty ) {
				dirtySettingIds.push( key );
			}
		} );
		wp.customize.previewer.send( 'dirtySettings', dirtySettingIds );
	};

	/**
	 * Ensure there is a Customizer setting for the supplied REST resource.
	 */
	self.ensureResourceSettingAndControl = function( resource ) {
		var path, customizeId;
		path = resource._links.self[0].href.substr( restResources.apiSettings.root.length );
		customizeId = 'rest_resource[' + path + ']';
		if ( ! wp.customize.has( customizeId ) ) {

			// @todo Should we store the JSON string or the JS object in the setting?
			wp.customize.create( customizeId, customizeId, JSON.stringify( resource ), {
				transport: 'postMessage',
				previewer: wp.customize.previewer
			} );
		}

		if ( ! wp.customize.control.has( customizeId ) ) {
			wp.customize.control.add( customizeId, new self.RestResourceControl( customizeId, {
				params: {
					settings: {
						'default': customizeId
					},
					section: 'rest_resources',
					priority: wp.customize.section( 'rest_resources' ).controls().length + 1
				}
			} ) );
		}
	};

	/**
	 * A control for managing a REST resource.
	 *
	 * @class
	 * @augments wp.customize.Control
	 * @augments wp.customize.Class
	 */
	self.RestResourceControl = wp.customize.Control.extend({

		/**
		 * Initializer.
		 *
		 * @class
		 *
		 * @param {string} id              Unique identifier for the control instance.
		 * @param {object} options         Options hash for the control instance.
		 * @param {object} options.params  Params hash for the control instance.
		 */
		initialize: function( id, options ) {
			var control = this, element;
			options = options || {};
			options.params = options.params || {};
			if ( ! options.params.content ) {
				options.params.content = $( '<li></li>', {
					id: 'customize-control-' + id.replace( /]/g, '' ).replace( /\[/g, '-' ),
					'class': 'customize-control customize-control-rest_resource'
				} );
			}
			if ( ! options.params.type ) {
				options.params.type = 'rest_resource';
			}
			if ( 'undefined' === typeof options.params.active ) {
				options.params.active = true;
			}
			if ( ! options.params.label ) {
				options.params.label = id.replace( /^rest_resource\[(.+?)]/, '$1' );
			}

			options.params.settingId = id;
			wp.customize.Control.prototype.initialize.call( control, id, options );

			// @todo Syntax highlighting code editor.
			element = new wp.customize.Element( control.container.find( 'textarea' ) );
			control.elements.push( element );
			element.sync( control.setting );
			element.set( control.setting() || '{}' );

			control.setting.bind( function( newValue ) {
				try {
					JSON.parse( newValue );
					control.container.removeClass( 'syntax-error' );
					if ( this.validationMessage ) {
						this.validationMessage.set( '' );
					}
				} catch ( e ) {
					control.container.addClass( 'syntax-error' );
					if ( this.validationMessage ) {
						this.validationMessage.set( e.message );
					}
				}
			} );
		}
	});

	/**
	 * A section for managing a REST resources.
	 *
	 * @class
	 * @augments wp.customize.Section
	 * @augments wp.customize.Class
	 */
	self.RestResourcesSection = wp.customize.Section.extend({

		ready: function() {
			var section = this;

			wp.customize.Section.prototype.ready.call( section );

			section.deferred.embedded.done(function() {
				var descriptionContainer, noRenderedAreasNotice, shouldShowNotice;
				descriptionContainer = section.container.find( '.customize-section-title' );

				noRenderedAreasNotice = $( $.trim( wp.template( 'customize-rest-resources-section-notice' )({
					message: self.l10n.noResourcesLoadedMessage
				}) ) );
				descriptionContainer.append( noRenderedAreasNotice );

				shouldShowNotice = function() {
					return ( 0 === _.filter( section.controls(), function( section ) {
						return section.active();
					} ).length );
				};

				/*
				 * Set the initial visibility state for rendered notice.
				 * Update the visibility of the notice whenever a reflow happens.
				 */
				noRenderedAreasNotice.toggle( shouldShowNotice() );
				wp.customize.previewer.deferred.active.done( function() {
					noRenderedAreasNotice.toggle( shouldShowNotice() );
				});
				wp.customize.bind( 'pane-contents-reflowed', function() {
					var duration = ( 'resolved' === wp.customize.previewer.deferred.active.state() ) ? 'fast' : 0;
					if ( shouldShowNotice() ) {
						noRenderedAreasNotice.slideDown( duration );
					} else {
						noRenderedAreasNotice.slideUp( duration );
					}
				});
			});
		},

		/**
		 * Allow an active section to be contextually active even when it has no active controls.
		 *
		 * @returns {boolean}
		 */
		isContextuallyActive: function() {
			var section = this;
			return section.active();
		}
	});

	wp.customize.controlConstructor.rest_resource = self.RestResourceControl;
	wp.customize.sectionConstructor.rest_resources = self.RestResourcesSection;

	wp.customize.bind( 'ready', function() {
		$.ajaxPrefilter( 'json', restResources.ajaxPrefilter );
		wp.customize.bind( 'add', self.notifyDirtySetting );
		wp.customize.bind( 'change', self.notifyDirtySetting );
		wp.customize.bind( 'saved', self.notifyDirtySettings );
		wp.customize.previewer.bind( 'previewedRestResource', self.ensureResourceSettingAndControl  );
	} );

	return self;
}( jQuery, wp, wp.customize.RestResources, console ) ); // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
