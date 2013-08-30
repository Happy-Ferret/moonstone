/**
	_moon.InputHeader_ extends <a href="#moon.Header">moon.Header</a> using an input for the title.

	The _title_ property will be used as the input placeholder, while the contents of the input
	can be set/read from the _value_ property.

	Users may catch _oninput_ and _onchange_ events from the embedded input in order to react to usre input.

	Example:

			{
				kind: "moon.InputHeader",
				title:"Input Header",
				titleAbove: "02",
				titleBelow: "Sub Header",
				subTitleBelow: "Sub-sub Header",
				classes:"moon-10h",
				oninput:"handleInput",
				onchange:"handleChange",
				components: [
					{kind: "moon.IconButton", src: "assets/icon-like.png"},
					{kind: "moon.IconButton", src: "assets/icon-next.png"}
				]
			}

*/
enyo.kind({
	//* @public
	name: "moon.InputHeader",
	kind: "moon.Header",
	published: {
		//* The value of the input
		value:"",
		placeholder:"just type"
	},
	events: {
		//* Fired on each keypress
		oninput:"",
		//* Fired when the user presses enter or blurs the input
		onchange:""
	},
	//* @protected
	bindings: [
		{from: ".value", to:".$.title.value", twoWay:true}
	],
	classes: "moon-header moon-input-header",
	componentOverrides: {
		title: {kind: "moon.InputDecorator", classes: 'moon-input-header-input-decorator', components: [
			{name: "titleInput", kind: "moon.Input", classes: "moon-header-font moon-header-title", onfocus:"focusHandler", onblur:"blurHandler"}
		]}
	},
	create: function() {
		this.inherited(arguments);
		this.placeholderChanged();
	},
	//* If _this.title_ or _this.content_ changed, the placeHolder value of a moon.Input will be updated
	contentChanged: function() {
		this.$.titleInput.setValue(this.title || this.content);
	},
	placeholderChanged: function() {
		this.$.titleInput.setPlaceholder(this.placeholder);
	},
	focusHandler : function() {
		if(this.$.titleInput.getValue() === this.title){
			this.$.titleInput.setValue("");
		}
	},
	blurHandler : function() {
		if(this.$.titleInput.getValue() === ""){
			this.$.titleInput.setValue(this.title || this.content);
		}
	},
	allowHtmlChanged: function() {
		this.$.titleBelow.setAllowHtmlText(this.allowHtml);
		this.$.subTitleBelow.setAllowHtmlText(this.allowHtml);
	}
});
