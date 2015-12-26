/* global wp, jQuery, _customizeRestResourcesL10n */

/**
 * A section for managing a REST resources.
 *
 * @class
 * @augments wp.customize.Section
 * @augments wp.customize.Class
 */
wp.customize.sectionConstructor.rest_resources = wp.customize.RestResourcesSection = wp.customize.Section.extend({

	ready: function() {
		var section = this, $ = jQuery;

		wp.customize.Section.prototype.ready.call( section );

		section.deferred.embedded.done(function() {
			var descriptionContainer, noRenderedAreasNotice, shouldShowNotice;
			descriptionContainer = section.container.find( '.customize-section-title' );

			noRenderedAreasNotice = $( $.trim( wp.template( 'customize-rest-resources-section-notice' )({
				message: section.params.noResourcesLoadedMessage
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
