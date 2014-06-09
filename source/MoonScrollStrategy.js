/**
	_moon.ScrollStrategy_ inherits from
	[enyo.TouchScrollStrategy](#enyo.TouchScrollStrategy). Its main purpose is to
	handle scroller paging for [moon.Scroller](#moon.Scroller) and
	[moon.DataList](#moon.DataList).
*/

enyo.kind({
	name: "moon.ScrollStrategy",
	kind: "enyo.TouchScrollStrategy",
	//* @public
	published: {
		/**
			The ratio of mousewheel "delta" units to pixels scrolled.  Increase this
			value to increase the distance scrolled by the scroll wheel. Note that
			mice/trackpads do not emit the same "delta" units per "notch" or flick of
			the scroll wheel/trackpad; that can vary based on intensity and momentum.
		*/
		scrollWheelMultiplier: 2,
		/**
			The ratio of the maximum distance scrolled by each scroll wheel event to
			the height/width of the viewport. Setting a value larger than 1 is not
			advised, since a single scroll event could move more than one viewport's
			worth of content (depending on the delta received), resulting in skipped
			content.
		*/
		scrollWheelPageMultiplier: 0.2,
		/**
			The ratio of the distance scrolled per tap of the paging button to the
			height/width of the viewport. Setting a value larger than 1 is not
			advised, since a paging button tap will move more than one viewport's
			worth of content, resulting in skipped content.
		*/
		paginationPageMultiplier: 0.8,
		/**
			The ratio of continuous-scrolling delta units to pixels scrolled. Increase
			this value to increase the distance scrolled when the pagination buttons
			are held.
		*/
		paginationScrollMultiplier: 8
	},
	//* @protected
	handlers: {
		onRequestScrollIntoView : "requestScrollIntoView",
		onRequestSetupBounds	: "requestSetupBounds",
		onenter                 : "enter",
		onleave                 : "leave"
	},
	//* @protected
	tools: [
		{kind: "ScrollMath", onScrollStart: "scrollMathStart", onScroll: "scrollMathScroll", onScrollStop: "scrollMathStop"}
	],
	components: [
		{name: "clientContainer", classes: "moon-scroller-client-wrapper", components: [
			{name: "viewport", classes:"moon-scroller-viewport", spotlight: "container", components: [
				{name: "client", classes: "enyo-touch-scroller matrix-scroll-client matrix3dsurface"}
			]}
		]},
		{name: "vColumn", classes: "moon-scroller-v-column", components: [
			{name: "pageUpControl", kind: "moon.PagingControl", defaultSpotlightDisappear: "pageDownControl", defaultSpotlightDown: "pageDownControl", side: "top", onPaginateScroll: "paginateScroll", onPaginate: "paginate"},
			{name: "vthumbContainer", classes: "moon-scroller-thumb-container moon-scroller-vthumb-container", components: [
				{name: "vthumb", kind: "moon.ScrollThumb", classes: "moon-scroller-vthumb hidden", axis: "v"}
			]},
			{name: "pageDownControl", kind: "moon.PagingControl", defaultSpotlightDisappear: "pageUpControl", defaultSpotlightUp: "pageUpControl", side: "bottom", onPaginateScroll: "paginateScroll", onPaginate: "paginate"}
		]},
		{name: "hColumn", classes: "moon-scroller-h-column", components: [
			{name: "pageLeftControl", kind: "moon.PagingControl", defaultSpotlightDisappear: "pageRightControl", defaultSpotlightRight: "pageRightControl", side: "left", onPaginateScroll: "paginateScroll", onPaginate: "paginate"},
			{name: "hthumbContainer", classes: "moon-scroller-thumb-container moon-scroller-hthumb-container", components: [
				{name: "hthumb", kind: "moon.ScrollThumb", classes: "moon-scroller-hthumb hidden", axis: "h"}
			]},
			{name: "pageRightControl", kind: "moon.PagingControl", defaultSpotlightDisappear: "pageLeftControl", defaultSpotlightLeft: "pageLeftControl", side: "right", onPaginateScroll: "paginateScroll", onPaginate: "paginate"}
		]},
		{kind: "Signals", onSpotlightModeChanged: "spotlightModeChanged", onkeydown: "paginate", isChrome: true}
	],
	create: function() {
		this.inherited(arguments);
		this.transform = enyo.dom.canTransform();
		this.accel = enyo.dom.canAccelerate();
		this.container.addClass("enyo-touch-strategy-container");
		this.translation = this.accel ? "matrix3d" : "matrix";
		this.showHideScrollColumns(this.spotlightPagingControls);
	},
	/**
		Calls super-super-inherited (i.e., skips _TouchScrollStrategy_'s)
		_rendered()_ function to avoid thumb flicker at render time. Then
		shows or hides page controls.
	*/
	rendered: function() {
		enyo.TouchScrollStrategy.prototype.rendered._inherited.apply(this, arguments);
		this.setupBounds();
		this.spotlightPagingControlsChanged();
	},
	resizeHandler: function() {
		this.resizing = true;
		this.resetCachedValues();
		this.setupBounds();
		this.resizing = false;
	},
	setupBounds: function() {
		this.calcBoundaries();
		this.syncScrollMath();
		this.enableDisableScrollColumns();
		this.setThumbSizeRatio();
		this.clampScrollPosition();
	},
	setLastFocusedChild: function(inControl) {
		enyo.Spotlight.Container.setLastFocusedChild(this.$.viewport, inControl);
	},

	//* @public
	//* Gets the left scroll position within the scroller.
	getScrollLeft: function() {
		return this.scrollLeft;
	},
	//* Gets the top scroll position within the scroller.
	getScrollTop: function() {
		return this.scrollTop;
	},
	//* Sets the left scroll position within the scroller.
	setScrollLeft: function(inLeft) {
		var m = this.$.scrollMath;
		m.setScrollX(-inLeft);
		m.stabilize();
	},
	//* Sets the top scroll position within the scroller.
	setScrollTop: function(inTop) {
		var m = this.$.scrollMath;
		m.setScrollY(-inTop);
		m.stabilize();
	},
	//* Scrolls to specific x/y positions within the scroll area.
	scrollTo: function(inX, inY, animate) {
		this.stop();
		if (this.resizing || animate === false) {
			var b = this.getScrollBounds();
			inX = Math.max(Math.min(inX, b.maxLeft), 0);
			inY = Math.max(Math.min(inY, b.maxTop),  0);
			this.effectScroll(inX, inY);
			this.bubble("onScroll");
		} else {
			this._scrollTo(inX, inY);
		}
	},

	//* @protected

	//* Overrides default _maxHeightChanged()_ method from _TouchScrollStrategy_.
	maxHeightChanged: function() {
		// content should cover scroller at a minimum if there's no max-height.
		this.$.client.applyStyle("min-height", this.maxHeight ? null : "100%");
		this.$.client.applyStyle("max-height", this.maxHeight);
		this.$.clientContainer.addRemoveClass("enyo-scrollee-fit", !this.maxHeight);
	},

	// Event handling

	//* Disables dragging.
	shouldDrag: function(inSender, inEvent) { return true; },
	//* On _hold_, stops scrolling.
	hold: function(inSender, inEvent) {
		if (!this.isPageControl(inEvent.originator)) {
			this.inherited(arguments);
		}
	},
	//* On _down_, stops scrolling.
	down: function(inSender, inEvent) {
		if (!this.isPageControl(inEvent.originator) && this.isScrolling() && !this.isOverscrolling()) {
			this.stop();
		}
	},
	//* On _mousewheel_, scrolls a fixed amount.
	mousewheel: function(inSender, inEvent) {
		if (this.useMouseWheel) {
			var isScrolling = this.isScrolling();
			this.scrollBounds = this._getScrollBounds();
			this.setupBounds();

			var x = null,
				y = null,
				showVertical = this.showVertical(),
				showHorizontal = this.showHorizontal(),
				dir = null,
				val = null,
				max = null,
				delta = null
			;

			//* If we don't have to scroll, allow mousewheel event to bubble
			if (!showVertical && !showHorizontal) {
				this.scrollBounds = null;
				return false;
			}

			if (showVertical) {
				dir = inEvent.wheelDeltaY >= 0 ? 1 : -1;
				val = Math.abs(inEvent.wheelDeltaY * this.scrollWheelMultiplier);
				max = this.scrollBounds.clientHeight * this.scrollWheelPageMultiplier;
				delta = Math.min(val, max);
				y = (isScrolling ? this.lastScrollToY : this.scrollTop) + -dir * delta;
			}

			if (showHorizontal) {
				var intDirection = 1;
				// Reverse the direction for RTL
				if (this.$.pageLeftControl.rtl) {
					intDirection = -1;
				}
				if (inEvent.wheelDeltaX) {
					dir = (inEvent.wheelDeltaX >= 0 ? 1 : -1) * intDirection;
					val = Math.abs(inEvent.wheelDeltaX * this.scrollWheelMultiplier);
					max = this.scrollBounds.clientWidth * this.scrollWheelPageMultiplier;
					delta = Math.min(val, max);
					x = (isScrolling ? this.lastScrollToX : this.scrollLeft) + -dir * delta;
				} else if (!showVertical) {
					// only use vertical wheel for horizontal scrolling when no vertical bars shown
					dir = (inEvent.wheelDeltaY >= 0 ? 1 : -1) * intDirection;
					val = Math.abs(inEvent.wheelDeltaY * this.scrollWheelMultiplier);
					max = this.scrollBounds.clientWidth * this.scrollWheelPageMultiplier;
					delta = Math.min(val, max);
					x = (isScrolling ? this.lastScrollToX : this.scrollLeft) + -dir * delta;
				}
			}

			this.scrollTo(x, y);
			inEvent.preventDefault();
			this.scrollBounds = null;
			return true;
		}
	},
	//* On _enter_, sets _this.hovering_ to true and shows pagination controls.
	enter: function(inSender, inEvent) {
		this.hovering = true;
		this.setupBounds();
		this.showHideScrollColumns(true);
		this.updateHoverOnPagingControls(true);
	},
	//* On _leave_, sets _this.hovering_ to false and hides pagination controls.
	leave: function(inSender, inEvent) {
		this.hovering = false;
		this.showHideScrollColumns(false);
	},
	//* Handles _paginate_ events sent from PagingControl buttons or Page Up/Down Key.
	paginate: function(inSender, inEvent) {
		var _oMath = this.$.scrollMath,
			_oSpot = enyo.Spotlight,
			_oUtil = _oSpot.Util,
			side = ''
		;
		if (inEvent.type !== undefined && inEvent.type === "keydown") {
			if(!_oSpot.hasCurrent() || !_oUtil.isChild(this.parent, _oSpot.getCurrent())) {
				return true;
			}
			switch (inEvent.keyIdentifier) {
			case "PageUp" : 
			case "U+1200021" :
				side = _oMath.vertical ? "top" : _oMath.horizontal ? "left" : side;
				break;
			case "PageDown" :
			case "U+1200022" :
				side = _oMath.vertical ? "bottom" : _oMath.horizontal ? "right" : side;
				break;
			default:
				return true;
			}

			if(this._paging === undefined) {
				this._paging = {
					set : false
				};
			}

			if(this._paging.set === false) {
				var target = _oSpot.getCurrent().getAbsoluteBounds(),
					boundary = this.$.viewport.getAbsoluteBounds()
				;
				this._paging.directions = [];
				this._paging.directions.push(_oMath.vertical ? "down" : _oMath.horizontal ? "right" : undefined);
				this._paging.directions.push(_oMath.vertical ? "up" : _oMath.horizontal ? "left" : undefined);
				this._paging.thumb = _oMath.vertical ? "vertical" : _oMath.horizontal ? "horizontal" : undefined;

				target.right = target.left + target.width - 1;
				target.bottom = target.top + target.height;
				boundary.right = boundary.left + boundary.width;
				boundary.bottom = boundary.top + boundary.height;
				
				target.originX = (this.rtl) ? target.right : target.left;
				target.originX = (target.originX < boundary.left || target.originX > boundary.right) ? 
										boundary.left + boundary.width/2 : target.originX;

				target.originY = target.top;
				target.originY = (target.originY < boundary.top || target.originY > boundary.bottom) ?
										boundary.top + boundary.height/2 : target.originY;
				
				this._paging.target = target;
				
				this._paging.set = true;
			}
		} else {
			side = inEvent.originator.side;
		}
		
		this.paging(side);
	},
	paging: function(side) {
		var sb = this.getScrollBounds(),
			scrollYDelta = sb.clientHeight * this.paginationPageMultiplier,
			scrollXDelta = sb.clientWidth * this.paginationPageMultiplier,
			x = this.getScrollLeft(),
			y = this.getScrollTop()
		;

		switch (side) {
		case "left":
			x -= scrollXDelta;
			break;
		case "top":
			y -= scrollYDelta;
			break;
		case "right":
			x += scrollXDelta;
			break;
		case "bottom":
			y += scrollYDelta;
			break;
		}

		x = Math.max(0, Math.min(x, sb.maxLeft));
		y = Math.max(0, Math.min(y, sb.maxTop));

		this._scrollTo(x, y);

		return true;
	},
	//* Handles _paginateScroll_ events sent from PagingControl buttons.
	paginateScroll: function(inSender, inEvent) {
		if (!inEvent || !inEvent.scrollDelta) {
			return;
		}

		var delta = inEvent.scrollDelta * this.paginationScrollMultiplier,
			side = inEvent.originator.side,
			val
		;

		switch (side) {
		case "left":
			val = this.scrollLeft - delta;
			// When we hit the left, bounce and end scrolling
			if (val <= -this.$.scrollMath.leftBoundary) {
				this.setScrollLeft(-this.$.scrollMath.leftBoundary);
				this.$.pageLeftControl.hitBoundary();
			} else {
				this.setScrollLeft(val);
			}
			break;
		case "top":
			val = this.scrollTop - delta;
			// When we hit the top, bounce and end scrolling
			if (val <= -this.$.scrollMath.topBoundary) {
				this.setScrollTop(-this.$.scrollMath.topBoundary);
				this.$.pageUpControl.hitBoundary();
			} else {
				this.setScrollTop(val);
			}
			break;
		case "right":
			val = this.scrollLeft + delta;
			// When we hit the right, bounce and end scrolling
			if (val >= -this.$.scrollMath.rightBoundary) {
				this.setScrollLeft(-this.$.scrollMath.rightBoundary);
				this.$.pageRightControl.hitBoundary();
			} else {
				this.setScrollLeft(val);
			}

			break;
		case "bottom":
			val = this.scrollTop + delta;
			// When we hit the bottom, bounce and end scrolling
			if (val >= -this.$.scrollMath.bottomBoundary) {
				this.setScrollTop(-this.$.scrollMath.bottomBoundary);
				this.$.pageDownControl.hitBoundary();
			} else {
				this.setScrollTop(val);
			}
			break;
		}

		return true;
	},
	//* Handles _scrollStop_ events sent from ScrollMath.
	scrollMathStop: function(inSender, inEvent) {
		this.inherited(arguments);
		// When the end of scroll animating.
		if(this._paging !== undefined && this._paging.set && inEvent.animating !== undefined && !inEvent.animating) {
			var doc = document,
				steps = 100,
				target = this._paging.target,
				deltaX = 1, deltaY = 1, x, y, oElement = null, oControl = null
			;
			this._paging.set = false;
			deltaX = this.rtl ? (-1)*deltaX : deltaX;
			
			// Find a control based on target coordinate
			for (var i = 0; i < steps; i++) {
				x = target.originX + deltaX * i;
				y = target.originY + deltaY * i;
				oElement = doc.elementFromPoint(x, y);
				oElement = enyo.$[oElement.id];
				if(oElement !== null && oElement.parent.name !== "client") {
					oControl = enyo.$[oElement.id];
					break;
				}
			}
			// Find a spottable control
			if(oControl !== null) {
				var oTemp = oControl;
				while(oTemp.parent.name !== "client") {
					if(!enyo.Spotlight.isSpottable(oTemp)) {
						oTemp = oTemp.parent;
					} else {
						oControl = oTemp;
						break; 
					}
				}
				if(!this._findSpottableObject(oControl, this._paging.directions[0])){
					if(!this._findSpottableObject(oControl, this._paging.directions[1])) {
						// Nothing spottable item in current viewport
						return false;
					}
				}
				this._paging.set = false;
			}
		}
		return true;
	},
	//* Find spottable item and spotlight to control inside viewport.
	_findSpottableObject: function(oControl, sDirection) {
		var _oSpotNN = enyo.Spotlight.NearestNeighbor;
		
		if(oControl === null) {
			return false;
		}

		if(!enyo.Spotlight.isSpottable(oControl)) {
			oControl = _oSpotNN.getNearestNeighbor(sDirection, oControl);
			if(oControl===null) {
				return false;
			}
		}

		var obj = oControl.getAbsoluteBounds();
		var vport = this.$.viewport.getAbsoluteBounds();

		obj.bottom = obj.top + obj.height;
		obj.right = obj.left + obj.width - 1;
		vport.bottom = vport.top + vport.height;
		vport.right = vport.left + vport.width;

		if( obj.top < vport.top || obj.left < vport.left
			|| obj.bottom > vport.bottom || obj.right > vport.right ) {
			var directions = ( obj.top < vport.top || obj.left < vport.left )
								? this._paging.directions[0] 
								: this._paging.directions[1];
			oControl = _oSpotNN.getNearestNeighbor(directions, oControl);
		}

		return (oControl===null) ? false : enyo.Spotlight.setCurrent(oControl);
	},
	//* Scrolls to specific x/y positions within the scroll area.
	_scrollTo: function(inX, inY) {
		this.lastScrollToX = inX;
		this.lastScrollToY = inY;
		this.$.scrollMath.scrollTo(inX, inY);
	},
	//* Returns true if _inControl_ is one of four page controls.
	isPageControl: function(inControl) {
		return (
			inControl === this.$.pageUpControl ||
			inControl === this.$.pageDownControl ||
			inControl === this.$.pageLeftControl ||
			inControl === this.$.pageRightControl
		);
	},
	calcBoundaries: function() {
		var s = this.$.scrollMath || this,
			b = this._getScrollBounds()
		;
		s.bottomBoundary = -1 * b.maxTop;
		s.rightBoundary = -1 * b.maxLeft;
	},
	effectScroll: function(inX, inY) {
		this.scrollLeft = (inX !== null && !isNaN(inX))? inX: (this.scrollLeft || 0);
		this.scrollTop  = (inY !== null && !isNaN(inY))? inY: (this.scrollTop  || 0);
		enyo.dom.transformValue(this.$.client, this.translation, this.generateMatrix());
	},
	generateMatrix: function() {
		var x = -1 * this.scrollLeft,
			y = -1 * this.scrollTop
		;

		/// Reverse the direction for RTL
		if (this.$.pageLeftControl.rtl) {
			x*= -1;
		}

		return (this.accel)
			?   "1,         0,     0,  0, "
			+   "0,         1,     0,  0, "
			+   "0,         0,     1,  0, "
			+    x + ", " + y + ", 1,  1"

			:   "1, 0, 0, 1, " + x + ", " + y
		;
	},
	effectScrollStop: function() { },
	effectOverscroll: function() { },
	spotlightPagingControlsChanged: function() {
		this.updateHoverOnPagingControls(!this.spotlightPagingControls);
		this.showHideScrollColumns(this.spotlightPagingControls);
		if (this.generated) {
			this.setupBounds();
		}
	},
	updateHoverOnPagingControls: function(hover) {
		enyo.forEach([
			this.$.pageLeftControl,
			this.$.pageRightControl,
			this.$.pageUpControl,
			this.$.pageDownControl
		], function(c) {
			c.addRemoveClass("hover", hover);
		}, this);
	},
	/**
		Because the thumb columns are a fixed size that impacts the scroll bounds,
		captures the difference for use in thumb rendering math.
	*/
	setThumbSizeRatio: function() {
		var scrollBounds = this.getScrollBounds();
		this.$.vthumb.setSizeRatio(this.getVerticalThumbBounds().height/scrollBounds.clientHeight);
		this.$.hthumb.setSizeRatio(this.getHorizontalThumbBounds().width/scrollBounds.clientWidth);
	},
	//* Responds to child components' requests to be scrolled into view.
	requestScrollIntoView: function(inSender, inEvent) {
		var showVertical, showHorizontal,
			bubble = false;
		if (!enyo.Spotlight.getPointerMode() || inEvent.scrollInPointerMode === true) {
			showVertical = this.showVertical();
			showHorizontal = this.showHorizontal();
			this.scrollBounds = this._getScrollBounds();
			this.setupBounds();
			this.scrollBounds = null;
			if (showVertical || showHorizontal) {
				this.animateToControl(inEvent.originator, inEvent.scrollFullPage, inEvent.scrollInPointerMode || false);
				if ((showVertical && this.$.scrollMath.bottomBoundary) || (showHorizontal && this.$.scrollMath.rightBoundary)) {
					this.alertThumbs();
				}				
			} else {
				// Scrollers that don't need to scroll bubble their onRequestScrollIntoView,
				// to allow items in nested scrollers to be scrolled
				bubble = true;
			}
		}
		return !bubble;
	},
	//* Responds to child components' requests to update scrollBounds without scrolling into view
	requestSetupBounds: function(inSender, inEvent) {
		this.scrollBounds = this._getScrollBounds();
		this.setupBounds();
		this.scrollBounds = null;
		if ((this.showVertical() && this.$.scrollMath.bottomBoundary) || (this.showHorizontal() && this.$.scrollMath.rightBoundary)) {
			this.alertThumbs();
		}
		return true;
	},
	spotlightModeChanged: function(inSender, inEvent) {
		var activatePageControls = this.shouldShowPageControls();
		this.showHideScrollColumns(activatePageControls);
		this.updateHoverOnPagingControls(activatePageControls);
	},
	//* Enables or disables scroll columns.
	enableDisableScrollColumns: function() {
		this.enableDisableVerticalScrollControls(this.showVertical());
		this.enableDisableHorizontalScrollControls(this.showHorizontal());
	},
	//* Enables or disables vertical scroll column.
	enableDisableVerticalScrollControls: function(inEnabled) {
		this.$.clientContainer.addRemoveClass("v-scroll-enabled", inEnabled);
		this.$.vColumn.addRemoveClass("v-scroll-enabled", inEnabled);
		this.$.hColumn.addRemoveClass("v-scroll-enabled", inEnabled);
		this.$.pageUpControl.spotlight = inEnabled && this.spotlightPagingControls;
		this.$.pageDownControl.spotlight = inEnabled && this.spotlightPagingControls;
	},
	//* Enables or disables horizontal scroll column.
	enableDisableHorizontalScrollControls: function(inEnabled) {
		this.$.clientContainer.addRemoveClass("h-scroll-enabled", inEnabled);
		this.$.vColumn.addRemoveClass("h-scroll-enabled", inEnabled);
		this.$.hColumn.addRemoveClass("h-scroll-enabled", inEnabled);
		this.$.pageLeftControl.spotlight = inEnabled && this.spotlightPagingControls;
		this.$.pageRightControl.spotlight = inEnabled && this.spotlightPagingControls;
	},
	//* Shows or hides scroll columns.
	showHideScrollColumns: function(inShow) {
		this.showHideVerticalScrollColumns(inShow);
		this.showHideHorizontalScrollColumns(inShow);
	},
	//* Shows or hides vertical scroll columns.
	showHideVerticalScrollColumns: function(inShow) {
		this.$.vColumn.addRemoveClass("visible", inShow || this.spotlightPagingControls);
	},
	//* Shows or hides horizontal scroll columns.
	showHideHorizontalScrollColumns: function(inShow) {
		this.$.hColumn.addRemoveClass("visible", inShow || this.spotlightPagingControls);
	},
	/**
		Returns boolean indicating whether page controls should be shown at all for
		this scroller.
	*/
	shouldShowPageControls: function() {
		return (enyo.Spotlight.getPointerMode() && this.hovering);
	},
	//* Determines whether we should be showing the vertical scroll column.
	showVertical: function() {
		return (this.getVertical() == "scroll" ||
				(this.getVertical() !== "hidden" &&
				((-1 * this.$.scrollMath.bottomBoundary > 0) || this.spotlightPagingControls)));
	},
	//* Determines whether we should be showing the horizontal scroll column.
	showHorizontal: function() {
		return (this.getHorizontal() == "scroll" ||
				(this.getHorizontal() !== "hidden" &&
				((-1 * this.$.scrollMath.rightBoundary > 0) || this.spotlightPagingControls)));
	},
	_getScrollBounds: function() {
		if (this.scrollBounds) {
			return this.scrollBounds;
		}
		var containerBounds = this.getContainerBounds(),
			s = this.getScrollSize(),
			b = {
				top: this.getScrollTop(),
				left: this.getScrollLeft(),
				clientHeight: containerBounds.height,
				clientWidth: containerBounds.width,
				height: s.height,
				width: s.width
			};

		b.maxLeft = Math.max(0, b.width - b.clientWidth);
		b.maxTop = Math.max(0, b.height - b.clientHeight);

		// Update disabled state of paging controls based on bounds
		var m = this.$.scrollMath,
			canVScroll = b.height > b.clientHeight,
			canHScroll = b.width > b.clientWidth
		;
		this.$.pageUpControl.setDisabled((b.top <= 0) || !canVScroll);
		this.$.pageDownControl.setDisabled((b.top >= -1 * m.bottomBoundary) || !canVScroll);
		this.$.pageLeftControl.setDisabled((b.left <= 0) || !canHScroll);
		this.$.pageRightControl.setDisabled((b.left >= -1 * m.rightBoundary) || !canHScroll);

		enyo.mixin(b, this.getOverScrollBounds());

		return b;
	},
	getContainerBounds: function() {
		var containerBounds = this.$.clientContainer.getBounds();
		if(containerBounds) {
			var paddingExtents = enyo.dom.calcPaddingExtents(this.$.clientContainer.hasNode());
			containerBounds.width  -= (paddingExtents.left + paddingExtents.right);
			containerBounds.height -= (paddingExtents.top  + paddingExtents.bottom);
		}
		return containerBounds;
	},
	getVerticalThumbBounds: function() {
		return this.vBounds ? this.vBounds : this.$.vthumbContainer.getBounds();
	},
	getHorizontalThumbBounds: function() {
		return this.hBounds ? this.hBounds : this.$.hthumbContainer.getBounds();
	},
	resetCachedValues: function() {
		this.vBounds = null;
		this.hBounds = null;
		this.scrollBounds = null;
	},
	/**
		Scrolls until _inControl_ is in view. If _inScrollFullPage_ is set, scrolls
		until the edge of _inControl_ is aligned with the edge of the visible scroll
		area.
	*/
	animateToControl: function(inControl, inScrollFullPage, animate) {
		var controlBounds  = inControl.getAbsoluteBounds(),
			absoluteBounds = this.$.viewport.getAbsoluteBounds(),
			scrollBounds   = this._getScrollBounds(),
			offsetTop,
			offsetLeft,
			offsetHeight,
			offsetWidth,
			xDir,
			yDir,
			x,
			y
		;

		// Make absolute controlBounds relative to scroll position
		controlBounds.top += scrollBounds.top;
		if (this.rtl) {
			controlBounds.right += scrollBounds.left;
		} else {
			controlBounds.left += scrollBounds.left;
		}

		offsetTop      = controlBounds.top - absoluteBounds.top;
		offsetLeft     = (this.rtl ? controlBounds.right : controlBounds.left) - (this.rtl ? absoluteBounds.right : absoluteBounds.left);
		offsetHeight   = controlBounds.height;
		offsetWidth    = controlBounds.width;

		// Allow local inScrollFullPage param to override scroller property
		inScrollFullPage = (typeof inScrollFullPage === "undefined") ? this.container.getScrollFullPage() : inScrollFullPage;

		// 0: currently visible, 1: right of viewport, -1: left of viewport
		xDir = (offsetLeft >= scrollBounds.left && offsetLeft + offsetWidth <= scrollBounds.left + scrollBounds.clientWidth)
			? 0
			: offsetLeft - scrollBounds.left > 0
				? 1
				: offsetLeft - scrollBounds.left < 0
					? -1
					: 0;

		// 0: currently visible, 1: below viewport, -1: above viewport
		yDir = (offsetTop >= scrollBounds.top && offsetTop + offsetHeight <= scrollBounds.top + scrollBounds.clientHeight)
			? 0
			: offsetTop - scrollBounds.top > 0
				? 1
				: offsetTop - scrollBounds.top < 0
					? -1
					: 0;

		scrollBounds.xDir = xDir;
		scrollBounds.yDir = yDir;

		switch (xDir) {
		case 0:
			x = this.getScrollLeft();
			break;
		case 1:
			// If control requested to be scrolled all the way to the viewport's left, or if the control
			// is larger than the viewport, scroll to the control's left edge. Otherwise, scroll just
			// far enough to get the control into view.
			if (inScrollFullPage || offsetWidth > scrollBounds.clientWidth) {
				x = offsetLeft;
			} else {
				x = offsetLeft - scrollBounds.clientWidth + offsetWidth;
				// If nodeStyle exists, add the _marginRight_ to the scroll value.
				x += enyo.dom.getComputedBoxValue(inControl.hasNode(), "margin", "right");
			}
			break;
		case -1:
			// If control requested to be scrolled all the way to the viewport's right, or if the control
			// is larger than the viewport, scroll to the control's right edge. Otherwise, scroll just
			// far enough to get the control into view.
			if (inScrollFullPage || offsetWidth > scrollBounds.clientWidth) {
				x = offsetLeft - scrollBounds.clientWidth + offsetWidth;
			} else {
				x = offsetLeft;
				// If nodeStyle exists, subtract the _marginLeft_ to the scroll value.
				x -= enyo.dom.getComputedBoxValue(inControl.hasNode(), "margin", "left");
			}
			break;
		}

		switch (yDir) {
		case 0:
			y = this.getScrollTop();
			break;
		case 1:
			// If control requested to be scrolled all the way to the viewport's top, or if the control
			// is larger than the viewport, scroll to the control's top edge. Otherwise, scroll just
			// far enough to get the control into view.
			if (inScrollFullPage || offsetHeight > scrollBounds.clientHeight) {
				y = offsetTop;
				// If nodeStyle exists, add the _marginBottom_ to the scroll value.
				y -= enyo.dom.getComputedBoxValue(inControl.hasNode(), "margin", "top");
			} else {
				y = offsetTop - scrollBounds.clientHeight + offsetHeight;
				// If nodeStyle exists, add the _marginBottom_ to the scroll value.
				y += enyo.dom.getComputedBoxValue(inControl.hasNode(), "margin", "bottom");
			}
			break;
		case -1:
			// If control requested to be scrolled all the way to the viewport's bottom, or if the control
			// is larger than the viewport, scroll to the control's bottom edge. Otherwise, scroll just
			// far enough to get the control into view.
			if (inScrollFullPage || offsetHeight > scrollBounds.clientHeight) {
				y = offsetTop - scrollBounds.clientHeight + offsetHeight;
			} else {
				y = offsetTop;
				// If nodeStyle exists, subtract the _marginTop_ to the scroll value.
				y -= enyo.dom.getComputedBoxValue(inControl.hasNode(), "margin", "bottom");
			}
			break;
		}

		// If x or y changed, scroll to new position
		if (x !== this.getScrollLeft() || y !== this.getScrollTop()) {
			this.scrollTo(x, y, animate);
		}
	},
	clampScrollPosition: function() {
		var x = this.clampX(),
			y = this.clampY();

		if (x !== this.getScrollLeft() || y !== this.getScrollTop()) {
			this.scrollTo(x, y);
		}
	},
	clampX: function() {
		var m = this.$.scrollMath;
		return Math.min(Math.max(this.getScrollLeft(), -1*m.leftBoundary), -1*m.rightBoundary);
	},
	clampY: function() {
		var m = this.$.scrollMath;
		return Math.min(Math.max(this.getScrollTop(), -1*m.topBoundary), -1*m.bottomBoundary);
	}
});

// FIXME: Webkit will change the scrollTop value of the scroller viewport to keep the current
// tab-focused control onscreen if we allow it to handle tabs itself, so we defeat native
// TAB focus movement here.
enyo.dispatcher.features.push(function(e) {
	if ((e.type == "keydown") && (e.keyCode == 9)) {
		e.preventDefault();
	}
});
