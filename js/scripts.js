$(document).ready(function(){

	setup();

	setTimeout(function(){setup();}, 1000);

});

$(window).resize(align);

$( ".card .screen" ).hover(
	function() {
		$(this).animate({opacity : 1 },200)
	},
	function() {
		$(this).animate({opacity : 0 },200);
	}
);

function setup() {

	align();

};

function align() {

	var height = $('#hero').height() - 80;
	var text_height = $('.content').height();
	var text_margin = (height - text_height) / 2;

	$('#hero .content').css({'margin-top': text_margin +"px"});

	$( ".card .picholder" ).each(function() {

		var w = $(this).width()*9/16;
		if (w > 400) { w = 400; }
		$(this).css({'height': w + "px"});

	});

};
