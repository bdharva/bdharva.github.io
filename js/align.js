$(document).ready(function(){
    align();
});

window.onresize = function(event) {
    align();
}

function align() {
    window_height = $(window).height();
    window_width = $(window).width();
    container_height = 600;
    margin = (window_height - container_height)/2;
    if (margin < 50){margin = 50;}
    if (window_width < 401){margin = 0;}
    $('.picture').css({'margin-top': margin + 'px'});
}