$(document).ready(function(){

	setup();

});

$(window).resize(align);

function setup() {

	align();

	$('.toggle').each(function(){
		$(this).find('.option').first().toggleClass('active');
	});

	$('.charttoggle').each(function(){
		$(this).find('.chart').toggleClass('inactive');
		$(this).find('.chart').first().toggleClass('inactive');
	});

};

function align() {

	var height = $('#hero').height() - 80;
	var text_height = $('.content').height();
	var text_margin = (height - text_height) / 2;

	$('#hero .content').css({'margin-top': text_margin +"px"});

};

$(window).on('scroll', function(){

    var scroll = $(this).scrollTop();
    var top = $("#datatable").offset().top;
		var bot = top + $("#datatable").height();
		var overlap = 100;
		var height = $("thead").height();


		if (scroll >= top + overlap && scroll <= bot ) {

			$('#datatable > thead').addClass('static');

		} else {

			$('#datatable > thead').removeClass('static');

		}

});

$(document).on("click", ".option:not('.active')", function() {
  $(this).parent().find('.option').each(function(){
		$(this).toggleClass('active');
		var target = "#" + $(this).attr('data');
		$(target).toggleClass('inactive');
	})
});
