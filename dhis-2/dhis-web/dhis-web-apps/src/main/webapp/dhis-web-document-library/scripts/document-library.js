
/* global dhis2, angular, selection, i18n_ajax_login_failed, _ */

dhis2.util.namespace('dhis2.doclib');

// whether current user has any organisation units
dhis2.doclib.emptyOrganisationUnits = false;

dhis2.doclib.apiUrl = '../api';

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
var batchSize = 50;

dhis2.doclib.store = null;
dhis2.doclib.metaDataCached = dhis2.doclib.metaDataCached || false;
dhis2.doclib.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.doclib.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.doclib.store = new dhis2.storage.Store({
    name: 'dhis2doclib',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['programs', 'optionSets', 'categoryCombos', 'attributes', 'ouLevels']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt
 * 2. Load meta-data (and notify ouwt)
 *
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();
});

$(document).bind('dhis2.online', function(event, loggedIn)
{
    if (loggedIn)
    {
        if (dhis2.doclib.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderDelayMessage(i18n_online_notification);
        }
    }
    else
    {
        var form = [
            '<form style="display:inline;">',
            '<label for="username">Username</label>',
            '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<label for="password">Password</label>',
            '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<button id="login_button" type="button">Login</button>',
            '</form>'
        ].join('');

        setHeaderMessage(form);
        ajax_login();
    }
});

$(document).bind('dhis2.offline', function()
{
    if (dhis2.doclib.emptyOrganisationUnits) {
        setHeaderMessage(i18n_no_orgunits);
    }
    else {
        setHeaderMessage(i18n_offline_notification);
    }
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

function downloadMetaData()
{
    console.log('Loading required meta-data');
    var def = $.Deferred();
    var promise = def.promise();

    promise = promise.then( dhis2.doclib.store.open );
    promise = promise.then( getUserProfile );
    promise = promise.then( getUserAccessiblePrograms );
    promise = promise.then( getOrgUnitLevels );
    promise = promise.then( getSystemSetting );

    //fetch programs
    promise = promise.then( getMetaPrograms );
    promise = promise.then( filterMissingPrograms );
    promise = promise.then( getPrograms );

    //fetch option sets
    promise = promise.then( getMetaOptionSets );
    promise = promise.then( filterMissingOptionSets );
    promise = promise.then( getOptionSets );

    //fetch indicator groups
    promise = promise.then( getMetaCategoryCombos );
    promise = promise.then( filterMissingCategoryCombos );
    promise = promise.then( getCategoryCombos );

    promise.done(function() {
        //Enable ou selection after meta-data has downloaded
        $( "#orgUnitTree" ).removeClass( "disable-clicks" );
        dhis2.doclib.metaDataCached = true;
        dhis2.availability.startAvailabilityCheck();
        console.log( 'Finished loading meta-data' );
        selection.responseReceived();
    });

    def.resolve();
}

function getUserProfile(){
    return dhis2.metadata.getMetaObject(null, 'USER_PROFILE', dhis2.doclib.apiUrl + '/me.json', 'fields=id,displayName,userCredentials[username]', 'sessionStorage', dhis2.doclib.store);
}

function getUserAccessiblePrograms(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_PROGRAMS', dhis2.doclib.apiUrl + '/programs.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.doclib.store);
}

function getOrgUnitLevels(){
    dhis2.doclib.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', dhis2.doclib.apiUrl + '/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.doclib.store);
    });
}

function getSystemSetting(){
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', dhis2.doclib.apiUrl + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms', 'sessionStorage', dhis2.doclib.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', dhis2.doclib.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.doclib.store, objs);
}

function getCategoryCombos( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'categoryCombos', 'categoryCombos', dhis2.doclib.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName,categoryOptions[displayName]],categories[id,displayName,code,dimension,dataDimensionType,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code]]', 'idb', dhis2.doclib.store);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', dhis2.doclib.apiUrl + '/programs.json', 'filter=programType:eq:WITHOUT_REGISTRATION&paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.doclib.store, objs);
}

function getPrograms( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'programs', 'programs', dhis2.doclib.apiUrl + '/programs.json', 'paging=false&fields=*,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id,level],programStages[*,programStageDataElements[id,dataElement[*,attributeValues[value,attribute[id,name,valueType,code]]]]]', 'idb', dhis2.doclib.store, dhis2.metadata.processObject);
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', dhis2.doclib.apiUrl + '/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.doclib.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'optionSets', 'optionSets', dhis2.doclib.apiUrl + '/optionSets.json', 'paging=false&fields=id,displayName,code,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code]', 'idb', dhis2.doclib.store, dhis2.metadata.processObject);
}

function getMetaIndicatorGroups(){
    return dhis2.metadata.getMetaObjectIds('indicatorGroups', dhis2.doclib.apiUrl + '/indicatorGroups.json', 'paging=false&fields=id,version');
}

function filterMissingIndicatorGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('indicatorGroups', dhis2.doclib.store, objs);
}

function getIndicatorGroups( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'indicatorGroups', 'indicatorGroups', dhis2.doclib.apiUrl + '/indicatorGroups.json', 'paging=false&fields=id,displayName,attributeValues[value,attribute[id,name,valueType,code]],indicators[id,displayName,denominatorDescription,numeratorDescription,dimensionItem,numerator,denominator,annualized,dimensionType,indicatorType[id,displayName,factor,number]]', 'idb', dhis2.doclib.store, dhis2.metadata.processObject);
}

function getMetaAttributes(){
    return dhis2.metadata.getMetaObjectIds('attributes', dhis2.doclib.apiUrl + '/attributes.json', 'paging=false&fields=id,version');
}

function filterMissingAttributes( objs ){
    return dhis2.metadata.filterMissingObjIds('attributes', dhis2.doclib.store, objs);
}

function getAttributes( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'attributes', 'attributes', dhis2.doclib.apiUrl + '/attributes.json', 'paging=false&fields=:all,!access,!lastUpdatedBy,!lastUpdated,!created,!href,!user,!translations,!favorites,optionSet[id,displayName,code,options[id,displayName,code,sortOrder]]', 'idb', dhis2.doclib.store, dhis2.metadata.processObject);
}