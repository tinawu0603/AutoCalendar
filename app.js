$(function() {
    // App configuration
    var authEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?';
    var redirectUri = 'http://localhost:8080';
    var appId = '3be8622a-f6a4-491c-afe3-8861f2c6e230';
    var scopes = 'openid profile User.Read Mail.Read Calendars.Read Calendars.Read.Shared Calendars.ReadWrite Calendars.ReadWrite.Shared Contacts.Read';

    // Variables for calendar IDs
    const tina_calendar = "AAMkADBjNTQyNDhjLWI0ZDAtNGFlMi1hYTI0LWY3MmY0MDllODYyMwBGAAAAAAB1nFXEGydgS6wfYdh8ts1aBwAgPukuwqLaRLsUY6FAAGy-AAAAdlUNAABKsb9HdbhuQYupNwxFHBN9AAAAABjdAAA=";

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
                if (errorresponse.error === 'login_required' ||
                    errorresponse.error === 'interaction_required') {
                    // For these errors redirect the browser to the login
                    // page.
                    window.location = buildAuthUrl();
                } else {
                    renderError(errorresponse.error, errorresponse.error_description);
                }
            },

            // Display inbox
            '#inbox': function () {
                if (isAuthenticated) {
                    renderInbox();
                } else {
                    // Redirect to home page
                    window.location.hash = '#';
                }
            },

            // Display events happening in this month
            '#month': function () {
                if (isAuthenticated) {
                    renderMonth();
                } else {
                    // Redirect to home page
                    window.location.hash = '#';
                }
            },

            // Display events happening in the next 7 days including today
            '#week': function () {
                if (isAuthenticated) {
                    renderWeek();
                } else {
                    // Redirect to home page
                    window.location.hash = '#';
                }
            },

            // Display the event request form
            '#event-request': function () {
                if (isAuthenticated) {
                    renderEventRequest();
                } else {
                    // Redirect to home page
                    window.location.hash = '#';
                }
            },

            // Display contacts
            /*
            '#contacts': function () {
                if (isAuthenticated) {
                    renderContacts();
                } else {
                    // Redirect to home page
                    window.location.hash = '#';
                }
            },
            */

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
        setActiveNav('#home-nav');
        if (isAuthed) {
            $('#username').text(sessionStorage.userDisplayName);
            $('#logged-in-welcome').show();
        } else {
            $('#connect-button').attr('href', buildAuthUrl());
            $('#signin-prompt').show();
        }
    }

    function renderInbox() {
        setActiveNav('#inbox-nav');
        $('#inbox-status').text('Loading...');
        $('#message-list').empty();
        $('#inbox').show();

        getUserInboxMessages(function(messages, error){
            if (error) {
                renderError('getUserInboxMessages failed', error);
            } else {
                $('#inbox-status').text('Here are the 10 most recent messages in your inbox.');
                var templateSource = $('#msg-list-template').html();
                var template = Handlebars.compile(templateSource);

                var msgList = template({messages: messages});
                $('#message-list').append(msgList);
            }
        });
    }

    // renders the events happening this month
    function renderMonth() {
        setActiveNav('#month-nav');
        $('#month-status').text('Loading...');
        $('#month-list').empty();
        $('#month').show();

        getUserMonthEvents(function(events, error){
            if (error) {
                renderError('getUserMonthEvents failed', error);
            } else {
                $('#month-status').text('Here are all the events on your calendar this month.');
                var templateSource = $('#event-list-template').html();
                var template = Handlebars.compile(templateSource);

                var eventList = template({events: events});
                $('#month-list').append(eventList);
            }
        });
    }

    // renders the events happening in the next 7 days including today
    function renderWeek() {
        setActiveNav('#week-nav');
        $('#week-status').text('Loading...');
        $('#week-list').empty();
        $('#week').show();

        getUserWeekEvents(function(events, error){
            if (error) {
                renderError('getUserWeekEvents failed', error);
            } else {
                $('#week-status').text('Here are all the events on your calendar in the next 7 days including today.');
                var templateSource = $('#event-list-template').html();
                var template = Handlebars.compile(templateSource);

                var eventList = template({events: events});
                $('#week-list').append(eventList);
            }
        });
    }

    // renders the event request form
    function renderEventRequest() {
        setActiveNav('#event-request-nav');
        $('#event-request').show();
        $("#requestForm").validator().on("submit", function(event){
            if (event.isDefaultPrevented()) {
                // handle the invalid form...
            } else {
                // everything looks good!
                event.preventDefault();
                submitForm();
            }
        });
    }

    function submitForm(){
        // Initiate Variables With Form Content
        var name = $("#nameInput").val();
        var email = $("#emailInput").val();
        var message = $("#eventTypeSelect").val();

        $.ajax({
            type: "POST",
            url: "/php/process.php",
            data: "name=" + name + "&email=" + email + "&message=" + message,
            success : function(text){
                if (text == "success"){
                    formSuccess();
                }
            }
        });
    }

    function formSuccess(){
        $( "#successSubmit" ).removeClass( "hidden" );
    }



    /*
    function renderContacts() {
        setActiveNav('#contacts-nav');
        $('#contacts-status').text('Loading...');
        $('#contact-list').empty();
        $('#contacts').show();

        getUserContacts(function(contacts, error){
            if (error) {
                renderError('getUserContacts failed', error);
            } else {
                $('#contacts-status').text('Here are your first 10 contacts.');
                var templateSource = $('#contact-list-template').html();
                var template = Handlebars.compile(templateSource);

                var contactList = template({contacts: contacts});
                $('#contact-list').append(contactList);
            }
        });
    }
    */

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
        // If this was a silent request remove the iframe
        $('#auth-iframe').remove();

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

        validateIdToken(function(isValid) {
            if (isValid) {
                // Re-render token to handle refresh
                renderTokens();

                // Redirect to home page
                window.location.hash = '#';
            } else {
                clearUserState();
                // Report error
                window.location.hash = '#error=Invalid+ID+token&error_description=ID+token+failed+validation,+please+try+signing+in+again.';
            }
        });
    }

    function validateIdToken(callback) {
        // Per Azure docs (and OpenID spec), we MUST validate
        // the ID token before using it. However, full validation
        // of the signature currently requires a server-side component
        // to fetch the public signing keys from Azure. This sample will
        // skip that part (technically violating the OpenID spec) and do
        // minimal validation

        if (null == sessionStorage.idToken || sessionStorage.idToken.length <= 0) {
            callback(false);
        }

        // JWT is in three parts seperated by '.'
        var tokenParts = sessionStorage.idToken.split('.');
        if (tokenParts.length != 3){
            callback(false);
        }

        // Parse the token parts
        var header = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(tokenParts[0]));
        var payload = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(tokenParts[1]));

        // Check the nonce
        if (payload.nonce != sessionStorage.authNonce) {
            sessionStorage.authNonce = '';
            callback(false);
        }

        sessionStorage.authNonce = '';

        // Check the audience
        if (payload.aud != appId) {
            callback(false);
        }

        // Check the issuer
        // Should be https://login.microsoftonline.com/{tenantid}/v2.0
        if (payload.iss !== 'https://login.microsoftonline.com/' + payload.tid + '/v2.0') {
            callback(false);
        }

        // Check the valid dates
        var now = new Date();
        // To allow for slight inconsistencies in system clocks, adjust by 5 minutes
        var notBefore = new Date((payload.nbf - 300) * 1000);
        var expires = new Date((payload.exp + 300) * 1000);
        if (now < notBefore || now > expires) {
            callback(false);
        }

        // Now that we've passed our checks, save the bits of data
        // we need from the token.

        sessionStorage.userDisplayName = payload.name;
        sessionStorage.userSigninName = payload.preferred_username;

        // Per the docs at:
        // https://azure.microsoft.com/en-us/documentation/articles/active-directory-v2-protocols-implicit/#send-the-sign-in-request
        // Check if this is a consumer account so we can set domain_hint properly
        sessionStorage.userDomainType =
            payload.tid === '9188040d-6c67-4c5b-b112-36a304b66dad' ? 'consumers' : 'organizations';

        callback(true);
    }

    function makeSilentTokenRequest(callback) {
        // Build up a hidden iframe
        var iframe = $('<iframe/>');
        iframe.attr('id', 'auth-iframe');
        iframe.attr('name', 'auth-iframe');
        iframe.appendTo('body');
        iframe.hide();

        iframe.load(function() {
            callback(sessionStorage.accessToken);
        });

        iframe.attr('src', buildAuthUrl() + '&prompt=none&domain_hint=' +
            sessionStorage.userDomainType + '&login_hint=' +
            sessionStorage.userSigninName);
    }

    // Helper method to validate token and refresh
    // if needed
    function getAccessToken(callback) {
        var now = new Date().getTime();
        var isExpired = now > parseInt(sessionStorage.tokenExpires);
        // Do we have a token already?
        if (sessionStorage.accessToken && !isExpired) {
            // Just return what we have
            if (callback) {
                callback(sessionStorage.accessToken);
            }
        } else {
            // Attempt to do a hidden iframe request
            makeSilentTokenRequest(callback);
        }
    }

    // OUTLOOK API FUNCTIONS =======================

    function getUserInboxMessages(callback) {
        getAccessToken(function(accessToken) {
            if (accessToken) {
                // Create a Graph client
                var client = MicrosoftGraph.Client.init({
                    authProvider: (done) => {
                        // Just return the token
                        done(null, accessToken);
                    }
                });

                // Get the 10 newest messages
                client
                    .api('/me/mailfolders/inbox/messages')
                    .top(10)
                    .select('subject,from,receivedDateTime,bodyPreview')
                    .orderby('receivedDateTime DESC')
                    .get((err, res) => {
                        if (err) {
                            callback(null, err);
                        } else {
                            callback(res.value);
                        }
                    });
            } else {
                var error = { responseText: 'Could not retrieve access token' };
                callback(null, error);
            }
        });
    }

    // Gets the list of events in this month
    function getUserMonthEvents(callback) {
        getAccessToken(function(accessToken) {
            if (accessToken) {
                // Create a Graph client
                var client = MicrosoftGraph.Client.init({
                    authProvider: (done) => {
                        // Just return the token
                        done(null, accessToken);
                    }
                });

                // Get the 10 newest events
                client
                    .api('/me/calendars/' + tina_calendar + '/calendarview?startDateTime=' + getMonthStart() +
                    '&endDateTime=' + getMonthEnd())
                    .select('subject,bodyPreview,start,end,location')
                    //.orderby('start/dateTime DESC')
                    .get((err, res) => {
                        if (err) {
                            callback(null, err);
                        } else {
                            callback(res.value);
                        }
                    });
            } else {
                var error = { responseText: 'Could not retrieve access token' };
                callback(null, error);
            }
        });
    }

    // Gets the list of events in the next 7 days including today
    function getUserWeekEvents(callback) {
        getAccessToken(function(accessToken) {
            if (accessToken) {
                // Create a Graph client
                var client = MicrosoftGraph.Client.init({
                    authProvider: (done) => {
                        // Just return the token
                        done(null, accessToken);
                    }
                });

                // Get the 10 newest events
                client
                    .api('/me/calendars/' + tina_calendar + '/calendarview?startDateTime=' + getWeekStart() +
                        '&endDateTime=' + getWeekEnd())
                    .select('subject,bodyPreview,start,end,location')
                    //.orderby('start/dateTime DESC')
                    .get((err, res) => {
                        if (err) {
                            callback(null, err);
                        } else {
                            callback(res.value);
                        }
                    });
            } else {
                var error = { responseText: 'Could not retrieve access token' };
                callback(null, error);
            }
        });
    }

    function getUserContacts(callback) {
        getAccessToken(function(accessToken) {
            if (accessToken) {
                // Create a Graph client
                var client = MicrosoftGraph.Client.init({
                    authProvider: (done) => {
                        // Just return the token
                        done(null, accessToken);
                    }
                });

                // Get the first 10 contacts in alphabetical order
                // by given name
                client
                    .api('/me/contacts')
                    .top(10)
                    .select('givenName,surname,emailAddresses')
                    .orderby('givenName ASC')
                    .get((err, res) => {
                        if (err) {
                            callback(null, err);
                        } else {
                            callback(res.value);
                        }
                    });
            } else {
                var error = { responseText: 'Could not retrieve access token' };
                callback(null, error);
            }
        });
    }

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

    Handlebars.registerHelper("formatDate", function(datetime){
        // Dates from API look like:
        // 2016-06-27T14:06:13Z

        var date = new Date(datetime);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    });

    // "2017-04-01T01:00:00"
    function getMonthStart() {
        var today = new Date();
        var mm = today.getMonth() + 1;
        var yyyy = today.getFullYear();
        return yyyy + '-' + mm + '-01T01:00:00';
    }

    function getMonthEnd() {
        var today = new Date();
        var mm = today.getMonth() + 1;
        var yyyy = today.getFullYear();
        var months = [1, 3, 5, 7, 8, 10, 12];
        if (mm == 2) {
            var dd = "28";
        } else if (months.includes(mm)) {
            var dd = "31";
        } else {
            var dd = "30";
        }
        return yyyy + '-' + mm + '-' + dd + 'T23:00:00';
    }

    function getWeekStart() {
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth() + 1;
        var yyyy = today.getFullYear();
        return yyyy + '-' + mm + '-' + dd + 'T01:00:00';
    }

    // + 7 days ahead
    function getWeekEnd() {
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth() + 1;
        var yyyy = today.getFullYear();
        if (dd < 22) {
            // no wrap-around to the next month
            return yyyy + '-' + mm + '-' + (dd + 6) + 'T23:00:00';
        } else {
            var months = [1, 3, 5, 7, 8, 10, 12];
            // wrap-around to the next month
            if (mm == 12) {
                mm == 1;
            } else {
                mm += 1;
            }
            // months that have 31 days
            if (mm == 2 && (dd + 6 > 28)) {
                var new_date = dd + 6 - 28;
                return yyyy + '-' + mm + '-' + new_date + 'T23:00:00';
            } else if (months.includes(mm) && (dd + 6 > 31)) {
                var new_date = dd + 6 - 31;
                return yyyy + '-' + mm + '-' + new_date + 'T23:00:00';
            } else if (!months.includes(mm) && (dd + 6 > 30)){
                var new_date = dd + 6 - 30;
                return yyyy + '-' + mm + '-' + new_date + 'T23:00:00';
            } else {
                return yyyy + '-' + mm + '-' + (dd + 6) + 'T23:00:00';
            }

        }



    }
});