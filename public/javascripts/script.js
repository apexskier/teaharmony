$(document).ready(function() {
    $('#next').click(function(e) {
        e.preventDefault();
        $('.page-1').fadeOut(200, function() {
            $('.page-2').fadeIn(200);
            $('input[name="email"]').focus();
        });
    });
    $('#back').click(function(e) {
        e.preventDefault();
        $('.page-2').fadeOut(200, function() {
            $('.page-1').fadeIn(200);
            $('input[name="username"]').focus();
        });
    });
    $('form').not('#mc-embedded-subscribe-form').on('submit', function(e) {
        $(this).find('button[type="submit"]').prop('disabled', true);
        $('#content').addClass('move-out');
        $('.alert').addClass('message-leave');
    });
    $('#content').removeClass('just-loaded');
    $('.alert').removeClass('message-out');
    $('a').click(function(e) {
        $('.alert').addClass('message-leave');
    });
});
