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
		var control = this, matches;
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
		matches = id.match( /^rest_resource\[(.+?)]/ );
		if ( ! matches ) {
			throw new Error( 'Illegal ID: ' + id );
		}
		control.route = matches[1];
		control.routeData = _.find( CustomizeRestResources.manager.schema, function( data, routePattern ) {
			var regex;
			// Replace named pattern with unnamed ones (since the former is not supported yet in JS).
			routePattern = routePattern.replace( /\(\?P<\w+>/g, '(' );
			regex = new RegExp( '^' + routePattern + '$' );
			return regex.test( '/' + control.route );
		} );

		if ( ! options.params.label ) {
			// @todo if ( control.routeData && control.routeData.schema.title ) { options.params.label = control.routeData.schema.title.charAt( 0 ).toUpperCase() + control.routeData.schema.title.slice( 1 ); }
			options.params.label = control.route;
		}

		options.params.settingId = id;
		wp.customize.Control.prototype.initialize.call( control, id, options );

		control.addElements();

		/**
		 * Prevent control from being deactivated when the preview refreshes.
		 *
		 * @returns {boolean}
		 */
		control.active.validate = function () {
			return true;
		};

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
	},

	/**
	 * Ensure the details element gets opened before focus is done.
	 */
	focus: function() {
		var control = this;
		control.container.find( 'details:first' ).prop( 'open', true );
		wp.customize.Control.prototype.focus.apply( this, arguments );
	},

	/**
	 * Add the elements for the control to manipulate the resource.
	 */
	addElements: function() {
		var control = this, element, textarea, elementContainer = control.container.find( '.elements-container:first' );
		// @todo if ( ! control.routeData || ! control.routeData.schema ) {
			textarea = jQuery( '<textarea>' );
			elementContainer.append( textarea );

			element = new wp.customize.Element( textarea );
			control.elements.push( element );
			element.sync( control.setting );
			element.set( control.setting() || '{}' );
		//} else {
			// @todo Given schema exported from PHP, iterate over endpoints and find options matching to then generate the controls to inject into the control.
			// @todo How to handle raw vs rendered? (Ultimately it is using server-side.)
		//}
	}
});