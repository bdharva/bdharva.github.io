$(document).ready(function(){

	setup();

	setTimeout(function(){setup();}, 1000);

});

$(window).resize(function(){

	align();

});

$(window).scroll(function(){

    var scrolled = $(window).scrollTop();
    
    if (scrolled > 524) {
        $('.banner').addClass('scrolled');
    } else {
        $('.banner').removeClass('scrolled');
    }

});

$('#showmenu').click(function(){

	$('.overlay').toggle(0, function(){
		$(this).animate({opacity:1}, 500);
	});

})

$('#hidemenu').click(function(){

	$('.overlay').animate({opacity:0}, 500);
	$('.overlay').toggle(0);

})

$('#showwork').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#hidework').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.work').toggle(0, function(){
		$(this).animate({opacity:1}, 500);
	});

})

$('#hidework').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#showwork').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.work').toggle(0, function(){
		$(this).animate({opacity:0}, 500);
	});

})

$('#showblog').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#hideblog').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.blog').toggle(0, function(){
		$(this).animate({opacity:1}, 500);
	});

})

$('#hideblog').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#showblog').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.blog').toggle(0, function(){
		$(this).animate({opacity:0}, 500);
	});

})

$('#showphotos').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#hidephotos').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.photos').toggle(0, function(){
		$(this).animate({opacity:1}, 500);
	});

})

$('#hidephotos').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#showphotos').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.photos').toggle(0, function(){
		$(this).animate({opacity:0}, 500);
	});

})

$('#showhighpoints').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#hidehighpoints').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.highpoints').toggle(0, function(){
		$(this).animate({opacity:1}, 500);
	});

})

$('#hidehighpoints').click(function(){

	$(this).animate({opacity:0}, 0);
	$(this).toggle(0);
	$('#showhighpoints').toggle(0, function(){
		$(this).animate({opacity:1}, 0);
	});
	$('ul.highpoints').toggle(0, function(){
		$(this).animate({opacity:0}, 500);
	});

})

function setup() {

	align();

};

function align() {

	var height = $('.screen').height() - 84;
	var text_height = $('.content').height();
	var text_margin = (height - text_height) / 2;

	$('#hero .content').css({'margin-top': text_margin +"px"});

	$( ".card .picholder" ).each(function() {

		var w = $(this).width()*9/16;
		if (w > 400) { w = 400; }
		$(this).css({'height': w + "px"});

	});

};
