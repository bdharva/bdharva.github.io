$(document).ready(function(){

	setup();

	setTimeout(function(){setup();}, 1000);

});

$(window).resize(align);

$(window).scroll(function(){

    var scrolled = $(window).scrollTop();
    var threshhold = $('#hero').height() - 100;

    if (scrolled >= threshhold) {

        $('header').addClass('scrolled');
    
    } else {
    
        $('header').removeClass('scrolled');
    
    }

});

$( ".card .screen" ).hover(
	function() {
		$(this).animate({opacity : 1 },200)
	},
	function() {
		$(this).animate({opacity : 0 },200);
	}
);

$('#showmenu').click(function() {

    menu_show(200);

});

$('#hidemenu').click(function() {

    menu_hide(200);

});

function menu_show(delay) {

    $('#showmenu').hide();
    $('#hidemenu').show();

    $('header').addClass('noshadow');
    $('#menu').animate({top : 0 + 'px'},200);

};

function menu_hide(delay) {

    $('header').removeClass('noshadow');
    $('#menu').animate({top : -$('#menu').height()},delay);
    $('#showmenu').show();
    $('#hidemenu').hide();

};

function setup() {

	setmenu();
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

function setmenu() {

    $('#hidemenu').hide();
    $('#hidemenu').css({'visibility':'visible'});
    $('#menu').css({'top':-$('#menu').height()});
    $('#menu').css({'visibility':'visible'});
    $('#menu').css({'right':0})

}