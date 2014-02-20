$(document).ready(function(){
    $(".picture").hover(function() {
        $(this).stop().animate({
            "background-size": "115%"
        }, 300, "swing");
    },
    function() {
        $(this).stop().animate({
            "background-size": "100%"
        }, 300, "swing");
    });
});