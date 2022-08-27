var scrolled;
var last_scroll_top = 0;
var delta = 5;
var nav_height = $('header').outerHeight();

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
    
    if(Math.abs(last_scroll_top - st) <= delta)
        return;
    
    if (st > last_scroll_top && st > nav_height){
        $('nav').addClass('tucked');
    } else {
        if(st + $(window).height() < $(document).height()) {
            $('nav').removeClass('tucked');
        }
    }
    
    last_scroll_top = st;
}

$('#showmenu').click(function(){

    $('.overlay').toggle(0, function(){
        $(this).animate({opacity:1}, 500);
    });

})

$('#hidemenu').click(function(){

    $('.overlay').animate({opacity:0}, 500);
    $('.overlay').toggle(0);

})
