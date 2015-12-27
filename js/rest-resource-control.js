/* global wp, JSON, CustomizeRestResources */

/**
 * A control for managing a REST resource.
 *
 * @class
 * @augments wp.customize.Control
 * @augments wp.customize.Class
 */
CustomizeRestResources.RestResourceControl = wp.customize.Control.extend({

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
			options.params.content = jQuery( '<li></li>', {
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
			var setting = this;
			try {
				JSON.parse( newValue );
				control.container.removeClass( 'syntax-error' );
				if ( setting.validationMessage ) {
					setting.validationMessage.set( '' );
				}
			} catch ( e ) {
				control.container.addClass( 'syntax-error' );
				if ( setting.validationMessage ) {
					setting.validationMessage.set( e.message );
				}
			}
		} );
	}
});