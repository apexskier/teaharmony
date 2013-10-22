$('#next').click(function() {
    $('.page-1').fadeOut(200, function() {
        $('.page-2').fadeIn(200);
    });
});
$('#back').click(function(e) {
    e.preventDefault();
    $('.page-2').fadeOut(200, function() {
        $('.page-1').fadeIn(200);
    });
});
