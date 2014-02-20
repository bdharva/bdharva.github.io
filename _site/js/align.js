$(document).ready(function(){
    align();
});

window.onresize = function(event) {
    align();
}

function align() {
    height = $(window).height();
    if (height > 600){
        margin = (height - 600)/2;
        if (margin > 50){
            $('.picture').css({'margin-top': margin + 'px'});
        }else{
            $('.picture').css({'margin-top': 50 + 'px'});
        }
    }else{
        $('.picture').css({'margin-top': 50 + 'px'});
    }
}