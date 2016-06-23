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

	$( ".card .screen" ).each(function() {
		
		var h = $(this).height();
		var e = $(this).find('h4').height();
		var d = h - e;
		var e = $(this).find('h4').css({'margin-top': d/2 + "px"});

	});

};

var scrolled;
var previous = 0;
var change = 5;
var height = $('header').outerHeight();

$(window).scroll(function(event){
    
    scrolled = true;

    var top = $(window).scrollTop();
    var threshhold = $('header').outerHeight() + $('#hero').outerHeight() ;

    if (top >= threshhold ) {

        $('header').css({'position': 'fixed'});

    } else {

        $('header').css({'position': 'absolute'});

    }

});

setInterval(function() {

    if (scrolled) {

        hasScrolled();
        scrolled = false;

    }

}, 250);

function hasScrolled() {

    var st = $(this).scrollTop();
    
    if(Math.abs(previous - st) <= change)

        return;
    
    if (st > previous && st > height){

        $('header').removeClass('nav-down').addClass('nav-up');

    } else {

        if(st + $(window).height() < $(document).height()) {
            $('header').removeClass('nav-up').addClass('nav-down');
        }
    }
    
    previous = st;
}