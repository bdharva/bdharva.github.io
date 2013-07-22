/*
 
 JAVASCRIPT DOCUMENT - BDHARVA.COM
 Author: Benjamin Harvatine (bdharva.com)
 Updated: Friday, June 28, 2013
 
 */

$(document).ready(function(){
    resizeElements();
});

$(window).load(function(){
    slideshow();
});

window.onresize = function(event) {
    resizeElements();
}

function resizeElements(){
    width = $(window).width();
    $('.picwrapper').css({'height': width/2 + 'px'});
    $('.picwrapper').css({'width': width + 'px'});
}
function slideshow(){
    $(".picwrapper > img:gt(0)").hide();
    setInterval(function() {
        $('.picwrapper > img:first')
        .fadeOut(2000)
        .next()
        .fadeIn(2000)
        .end()
        .appendTo('.picwrapper');
    },  4000);
}