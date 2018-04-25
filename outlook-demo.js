$(function() {
    // App configuration
    var authEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?';
    var redirectUri = 'http://localhost:8080';
    var appId = '3be8622a-f6a4-491c-afe3-8861f2c6e230';
    var scopes = 'openid profile User.Read Mail.Read Calendars.Read Calendars.Read.Shared Calendars.ReadWrite Calendars.ReadWrite.Shared';

    // Check for browser support for sessionStorage
    if (typeof(Storage) === 'undefined') {
        render('#unsupportedbrowser');
        return;
    }

    // Check for browser support for crypto.getRandomValues
    var cryptObj = window.crypto || window.msCrypto; // For IE11
    if (cryptObj === undefined || cryptObj.getRandomValues === 'undefined') {
        render('#unsupportedbrowser');
        return;
    }

    render(window.location.hash);

    $(window).on('hashchange', function() {
        render(window.location.hash);
    });

    function render(hash) {

        var action = hash.split('=')[0];

        // Hide everything
        $('.main-container .page').hide();

        // Check for presence of access token
        var isAuthenticated = (sessionStorage.accessToken != null && sessionStorage.accessToken.length > 0);
        renderNav(isAuthenticated);
        renderTokens();

        var pagemap = {

            // Welcome page
            '': function() {
                renderWelcome(isAuthenticated);
            },

            // Receive access token
            '#access_token': function() {
                handleTokenResponse(hash);
            },

            // Signout
            '#signout': function () {
                clearUserState();

                // Redirect to home page
                window.location.hash = '#';
            },

            // Error display
            '#error': function () {
                var errorresponse = parseHashParams(hash);
                renderError(errorresponse.error, errorresponse.error_description);
            },

            // Display inbox

            // Shown if browser doesn't support session storage
            '#unsupportedbrowser': function () {
                $('#unsupported').show();
            }
        }

        if (pagemap[action]){
            pagemap[action]();
        } else {
            // Redirect to home page
            window.location.hash = '#';
        }
    }

    function setActiveNav(navId) {
        $('#navbar').find('li').removeClass('active');
        $(navId).addClass('active');
    }

    function renderNav(isAuthed) {
        if (isAuthed) {
            $('.authed-nav').show();
        } else {
            $('.authed-nav').hide();
        }
    }

    function renderTokens() {
        if (sessionStorage.accessToken) {
            // For demo purposes display the token and expiration
            var expireDate = new Date(parseInt(sessionStorage.tokenExpires));
            $('#token', window.parent.document).text(sessionStorage.accessToken);
            $('#expires-display', window.parent.document).text(expireDate.toLocaleDateString() + ' ' + expireDate.toLocaleTimeString());
            if (sessionStorage.idToken) {
                $('#id-token', window.parent.document).text(sessionStorage.idToken);
            }
            $('#token-display', window.parent.document).show();
        } else {
            $('#token-display', window.parent.document).hide();
        }
    }

    function renderError(error, description) {
        $('#error-name', window.parent.document).text('An error occurred: ' + decodePlusEscaped(error));
        $('#error-desc', window.parent.document).text(decodePlusEscaped(description));
        $('#error-display', window.parent.document).show();
    }

    function renderWelcome(isAuthed) {
        if (isAuthed) {
            $('#username').text(sessionStorage.userDisplayName);
            $('#logged-in-welcome').show();
            setActiveNav('#home-nav');
        } else {
            $('#connect-button').attr('href', buildAuthUrl());
            $('#signin-prompt').show();
        }
    }

    // OAUTH FUNCTIONS =============================
    function buildAuthUrl() {
        // Generate random values for state and nonce
        sessionStorage.authState = guid();
        sessionStorage.authNonce = guid();

        var authParams = {
            response_type: 'id_token token',
            client_id: appId,
            redirect_uri: redirectUri,
            scope: scopes,
            state: sessionStorage.authState,
            nonce: sessionStorage.authNonce,
            response_mode: 'fragment'
        };

        return authEndpoint + $.param(authParams);
    }

    function handleTokenResponse(hash) {
        // clear tokens
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('idToken');

        var tokenresponse = parseHashParams(hash);

        // Check that state is what we sent in sign in request
        if (tokenresponse.state != sessionStorage.authState) {
            sessionStorage.removeItem('authState');
            sessionStorage.removeItem('authNonce');
            // Report error
            window.location.hash = '#error=Invalid+state&error_description=The+state+in+the+authorization+response+did+not+match+the+expected+value.+Please+try+signing+in+again.';
            return;
        }

        sessionStorage.authState = '';
        sessionStorage.accessToken = tokenresponse.access_token;

        // Get the number of seconds the token is valid for,
        // Subract 5 minutes (300 sec) to account for differences in clock settings
        // Convert to milliseconds
        var expiresin = (parseInt(tokenresponse.expires_in) - 300) * 1000;
        var now = new Date();
        var expireDate = new Date(now.getTime() + expiresin);
        sessionStorage.tokenExpires = expireDate.getTime();

        sessionStorage.idToken = tokenresponse.id_token;

        // Redirect to home page
        window.location.hash = '#';
    }

    // OUTLOOK API FUNCTIONS =======================

    // HELPER FUNCTIONS ============================
    function guid() {
        var buf = new Uint16Array(8);
        cryptObj.getRandomValues(buf);
        function s4(num) {
            var ret = num.toString(16);
            while (ret.length < 4) {
                ret = '0' + ret;
            }
            return ret;
        }
        return s4(buf[0]) + s4(buf[1]) + '-' + s4(buf[2]) + '-' + s4(buf[3]) + '-' +
            s4(buf[4]) + '-' + s4(buf[5]) + s4(buf[6]) + s4(buf[7]);
    }

    function parseHashParams(hash) {
        var params = hash.slice(1).split('&');

        var paramarray = {};
        params.forEach(function(param) {
            param = param.split('=');
            paramarray[param[0]] = param[1];
        });

        return paramarray;
    }

    function decodePlusEscaped(value) {
        // decodeURIComponent doesn't handle spaces escaped
        // as '+'
        if (value) {
            return decodeURIComponent(value.replace(/\+/g, ' '));
        } else {
            return '';
        }
    }

    function clearUserState() {
        // Clear session
        sessionStorage.clear();
    }

});