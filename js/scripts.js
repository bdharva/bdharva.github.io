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

		var w = $(this).width()*2/3;
		if (w > 400) { w = 400; }
		$(this).css({'height': w + "px"});

	});

};

var scrolled;
var previous = 0;
var change = 5;
var height = $('header').outerHeight();

$(window).scroll(function(event){

	scrolled = true;

});

setInterval(function() {

	if (scrolled) {

		hasScrolled();
		scrolled = false;

	}

}, 250);

function hasScrolled() {

	var st = $(this).scrollTop();
	var top = $(window).scrollTop();
	var threshhold = $('header').outerHeight() + $('#hero').outerHeight();

	if(Math.abs(previous - st) <= change)

	return;

	if (st > previous && st > height){

		$('header.fixed').addClass('nav-up');

	} else if(top > threshhold) {

		$('header.fixed').removeClass('nav-up');

	} else {

		$('header.fixed').addClass('nav-up');

	}

	previous = st;

}
