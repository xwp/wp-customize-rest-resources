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

		/**
		 * Prevent control from being deactivated when the preview refreshes.
		 *
		 * @returns {boolean}
		 */
		control.active.validate = function() {
			return true;
		};
	},

	ready: function() {
		var control = this;

		control.parsedSettingValue = new wp.customize.Value();

		control.setting.bind( function( newValue ) {
			var setting = this, parsedValue, notification;
			try {
				parsedValue = JSON.parse( newValue );
				control.container.removeClass( 'syntax-error' );
				setting.notifications.remove( 'json_error' );

				// Update the parsed setting value which will trigger the updates.
				if ( ! _.isEqual( parsedValue, control.parsedSettingValue.get() ) ) {
					control.parsedSettingValue.set( parsedValue );
				}
			} catch ( e ) {
				control.container.addClass( 'syntax-error' );
				notification = new wp.customize.Notification( 'json_error', {
					message: e.message
				} );
				setting.notifications.add( notification.code, notification );
			}
		} );

		// Set initial value for parsedSettingValue.
		control.parsedSettingValue.set( JSON.parse( control.setting() || '{}' ) );

		control.addRouteFields();
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
	 * Add default route fields derived from the route schema.
	 */
	addRouteFields: function() {
		var control = this, element, ul, textarea, elementContainer = control.container.find( '.elements-container:first' );

		// If no route schema available, fallback to just displaying a JSON textarea.
		if ( ! control.routeData || ! control.routeData.schema ) {
			textarea = jQuery( '<textarea>' );
			elementContainer.append( textarea );

			element = new wp.customize.Element( textarea );
			control.elements.push( element );
			element.sync( control.setting );
			element.set( control.setting() || '{}' );
			return;
		}

		ul = jQuery( '<ul>' );
		_.each( control.routeData.schema.properties, function( fieldData, fieldId ) {
			var field = control.createRouteFieldElement( fieldId );
			ul.append( field.container );
		} );
		elementContainer.append( ul );

		// @todo Underscore template, let us be able to define the template for each route. This is essential because each resource type can have tailored field orders.
		// @todo Given schema exported from PHP, iterate over endpoints and find options matching to then generate the controls to inject into the control.
		// @todo How to handle raw vs rendered? (Ultimately it is using server-side.)
	},

	/**
	 * Return whether the supplied string has a timezone identifier suffix.
	 *
	 * @param {string} datetimeString
	 * @returns {boolean}
	 */
	hasTimezoneSuffix: function( datetimeString ) {
		return /(Z|[-+]\d\d:?\d\d)$/.test( datetimeString );
	},

	/**
	 * Create a new Element for a given Route field.
	 *
	 * @param {string} fieldId
	 * @returns {{element: *, container: *}|null}
	 */
	createRouteFieldElement: function( fieldId ) {
		var control = this, fieldSchema, elementValue, settingValue, element, input, container, domElementId, hasRaw, isNestedFallbackInput, matches, isDateGMT;
		domElementId  = 'element.' + control.route + '.' + fieldId;
		fieldSchema = control.routeData.schema.properties[ fieldId ];
		settingValue = control.parsedSettingValue.get();
		hasRaw = false;
		isDateGMT = false;

		container = jQuery( '<li>' );
		container.append( jQuery( '<label>', {
			text: fieldId,
			'for': domElementId
		} ) );

		// @todo Handle recursive.

		// Handled nested raw/rendered objects, promoting the raw value to the top-level.
		if ( 'object' === fieldSchema.type ) {
			if ( fieldSchema.properties && fieldSchema.properties.raw && ! _.isUndefined( settingValue[ fieldId ].raw ) ) {
				fieldSchema = fieldSchema.properties.raw;
				hasRaw = true;
			}
		}

		// @todo Implement nested/recursive properties (other than raw).
		isNestedFallbackInput = ( 'object' === fieldSchema.type || 'array' === fieldSchema.type );

		if ( isNestedFallbackInput ) {
			input = jQuery( '<textarea>' );
		} else if ( fieldSchema['enum'] ) {
			input = jQuery( '<select>' );
			_.each( fieldSchema['enum'], function( optionValue ) {
				input.append( jQuery( '<option>', {
					text: optionValue
				} ) );
			} );
		} else {
			input = jQuery( '<input>' );
			if ( 'integer' === fieldSchema.type || 'number' === fieldSchema.type ) {
				input.attr( 'type', 'number' );
				if ( 'integer' === fieldSchema.type ) {
					input.attr( 'step', '1' );
				}
				if ( fieldSchema.maximum ) {
					input.attr( 'max', fieldSchema.maximum );
				}
				if ( fieldSchema.minimum ) {
					input.attr( 'min', fieldSchema.minimum );
				}
			} else if ( 'number' === fieldSchema.type ) {
				input.attr( 'type', 'number' );
			} else if ( 'boolean' === fieldSchema.type ) {
				input.attr( 'type', 'checkbox' );
			} else if ( 'uri' === fieldSchema.format ) {
				input.attr( 'type', 'url' );
			} else if ( 'email' === fieldSchema.format ) {
				input.attr( 'type', 'email' );
			} else if ( 'string' === fieldSchema.type ) {

				// @todo if ( 'date-time' === fieldSchema.format ) { input.attr( 'type', 'datetime-local' ); }
				input.attr( 'type', 'text' );
				if ( fieldSchema.maxLength ) {
					input.attr( 'maxlength', fieldSchema.maxLength );
				}
				if ( fieldSchema.minLength ) {
					input.attr( 'minlength', fieldSchema.minLength );
				}
			}

			if ( fieldSchema.pattern ) {
				input.attr( 'pattern', '^(' + fieldSchema.pattern + ')$' );
			}
		}

		// @todo Implement more JSON Schema validation constraints.

		input.attr({
			id: domElementId,
			name: domElementId,
			'data-field-id': fieldId,
			title: fieldSchema.description
		});
		if ( fieldSchema.readonly ) {
			input.prop( 'readonly', true );
		}

		container.append( input );

		element = new wp.customize.Element( input );
		if ( hasRaw ) {
			elementValue = settingValue[ fieldId ].raw;
		} else {
			elementValue = settingValue[ fieldId ];
		}

		// Make GMT dates readonly if there is a corresponding non-GMT field in the schema.
		matches = fieldId.match( /^(.+)_gmt$/ );
		if ( matches && 'date-time' === fieldSchema.format && ! _.isUndefined( control.routeData.schema.properties[ matches[1] ] ) ) {
			input.prop( 'readonly', true );
			isDateGMT = true;

			// @todo We could do some client-side translation of the local time to GMT.
		}

		element.validate = function( value ) {
			if ( isNestedFallbackInput ) {

				// For JSON fields.
				if ( ! _.isString( value ) ) {
					value = JSON.stringify( value );
				}
			} else if ( value && 'date-time' === fieldSchema.format && ! control.hasTimezoneSuffix( value ) ) {
				if ( isDateGMT ) {
					value += 'Z';
				} else {
					value += CustomizeRestResources.manager.timezoneOffsetString;
				}
			}
			return value;
		};

		element.set( elementValue );
		control.parsedSettingValue.bind( function( settingValue ) {
			var elementValue;
			if ( hasRaw ) {
				elementValue = settingValue[ fieldId ].raw;
			} else {
				elementValue = settingValue[ fieldId ];
			}
			element.set( elementValue );
		} );

		element.bind( function( fieldElementValue ) {
			var resourceSettingValue;
			resourceSettingValue = control.parsedSettingValue.get();

			// @todo prevent recursion?

			if ( 'number' === fieldSchema.type || 'integer' === fieldSchema.type ) {
				fieldElementValue = Number( fieldElementValue );
			} else if ( isNestedFallbackInput ) {
				try {
					fieldElementValue = JSON.parse( fieldElementValue );
					container.removeClass( 'json-parse-error' );
					input[0].setCustomValidity( '' );
				} catch ( e ) {
					container.addClass( 'json-parse-error' );
					input[0].setCustomValidity( e.message );
					if ( input[0].reportValidity ) {
						input[0].reportValidity();
					}
					return;
				}
			}

			if ( hasRaw ) {
				resourceSettingValue[ fieldId ].raw = fieldElementValue;

				// @todo We need to do a round-trip to the server to get the actual rendered value.
				resourceSettingValue[ fieldId ].rendered = fieldElementValue;
			} else {
				resourceSettingValue[ fieldId ] = fieldElementValue;
			}
			control.setting.set( JSON.stringify( resourceSettingValue ) );
		} );

		return {
			element: element,
			container: container
		};
	}
});
