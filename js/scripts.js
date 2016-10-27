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

	$( ".card .pic" ).each(function() {

		var w = $(this).width()*.9;
		if (w > 400) { w = 400; }
		$(this).css({'height': w + "px"});

	});

};

$(window).scroll(function(event){

	var top = $(window).scrollTop();
	var threshhold = $('#hero').outerHeight() ;

	if (top >= threshhold ) {

		$('header.fixed').removeClass('nav-up').addClass('nav-down');

	} else {

		$('header.fixed').removeClass('nav-down').addClass('nav-up');

	}

});
