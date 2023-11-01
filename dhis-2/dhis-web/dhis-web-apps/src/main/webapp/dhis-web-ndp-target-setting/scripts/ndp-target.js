/* global dhis2, angular, selection, i18n_ajax_login_failed, _ */

dhis2.util.namespace('dhis2.ndpde');

// whether current user has any organisation units
dhis2.ndpde.emptyOrganisationUnits = false;

dhis2.ndpde.apiUrl = '../api';

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
var batchSize = 50;

dhis2.ndpde.store = null;
dhis2.ndpde.metaDataCached = dhis2.ndpde.metaDataCached || false;
dhis2.ndpde.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.ndpde.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.ndpde.store = new dhis2.storage.Store({
    name: 'dhis2ndpde',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['dataSets', 'optionSets', 'categoryCombos', 'ouLevels', 'programs']
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
        if (dhis2.ndpde.emptyOrganisationUnits) {
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
    if (dhis2.ndpde.emptyOrganisationUnits) {
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

    promise = promise.then( dhis2.ndpde.store.open );

    promise = promise.then( getUserProfile );
    promise = promise.then( getUserAccessibleDataSets );
    promise = promise.then( getUserAccessibleOptionCombos );
    promise = promise.then( getOrgUnitLevels );
    promise = promise.then( getSystemSetting );

    //fetch data sets
    promise = promise.then( getMetaDataSets );
    promise = promise.then( filterMissingDataSets );
    promise = promise.then( getDataSets );

    //fetch option sets
    promise = promise.then( getMetaOptionSets );
    promise = promise.then( filterMissingOptionSets );
    promise = promise.then( getOptionSets );

    //fetch category combos
    promise = promise.then( getMetaCategoryCombos );
    promise = promise.then( filterMissingCategoryCombos );
    promise = promise.then( getCategoryCombos );

    //fetch programs
    promise = promise.then( getMetaPrograms );
    promise = promise.then( filterMissingPrograms );
    promise = promise.then( getPrograms );

    promise.done(function() {
        //Enable ou selection after meta-data has downloaded
        $( "#orgUnitTree" ).removeClass( "disable-clicks" );
        dhis2.ndpde.metaDataCached = true;
        dhis2.availability.startAvailabilityCheck();
        console.log( 'Finished loading meta-data' );
        selection.responseReceived();
    });

    def.resolve();
};

function getUserProfile(){
    return dhis2.metadata.getMetaObject(null, 'USER_PROFILE', dhis2.ndpde.apiUrl + '/me.json', 'fields=id,displayName,userCredentials[username, displayName],authorities', 'sessionStorage', dhis2.ndpde.store);
}

function getUserAccessibleDataSets(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_DATASETS', dhis2.ndpde.apiUrl + '/dataSets.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.ndpde.store);
}

function getUserAccessibleOptionCombos(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_OPTION_COMBOS', dhis2.ndpde.apiUrl + '/categoryCombos.json', 'fields=id,categoryOptionCombos[id,categoryOptions[id,attributeValues[value,attribute[id,name,valueType,code]],access[:all]]]&paging=false', 'sessionStorage', dhis2.ndpde.store, dhis2.metadata.processOptionCombos);
}

function getOrgUnitLevels()
{
    dhis2.ndpde.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', dhis2.ndpde.apiUrl + '/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.ndpde.store);
    });
}

function getSystemSetting(){
    if(localStorage['SYSTEM_SETTING']){
       return;
    }
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', dhis2.ndpde.apiUrl + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms', '', 'localStorage', dhis2.ndpde.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', dhis2.ndpde.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.ndpde.store, objs);
}

function getCategoryCombos( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'categoryCombos', 'categoryCombos', dhis2.ndpde.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName,categoryOptions[id,displayName]],categories[id,displayName,code,dimension,dataDimensionType,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code]]', 'idb', dhis2.ndpde.store);
}

function getMetaDataSets(){
    return dhis2.metadata.getMetaObjectIds('dataSets', dhis2.ndpde.apiUrl + '/dataSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataSets', dhis2.ndpde.store, objs);
}

function getDataSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'dataSets', 'dataSets', dhis2.ndpde.apiUrl + '/dataSets.json', 'paging=false&fields=id,periodType,openFuturePeriods,displayName,version,categoryCombo[id],sections[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id],dataSetElements[id,dataElement[:all,optionSet[id],attributeValues[value,attribute[id,name,valueType,code]],categoryCombo[id]]]', 'idb', dhis2.ndpde.store, '');
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', dhis2.ndpde.apiUrl + '/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.ndpde.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'optionSets', 'optionSets', dhis2.ndpde.apiUrl + '/optionSets.json', 'paging=false&fields=id,displayName,code,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code]', 'idb', dhis2.ndpde.store, dhis2.metadata.processObject);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', dhis2.ndpde.apiUrl + '/programs.json', 'filter=programType:eq:WITHOUT_REGISTRATION&paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.ndpde.store, objs);
}

function getPrograms( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'programs', 'programs', dhis2.ndpde.apiUrl + '/programs.json', 'paging=false&fields=*,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id,level],programStages[*,programStageDataElements[id,dataElement[*,attributeValues[value,attribute[id,name,valueType,code]]]]]', 'idb', dhis2.ndpde.store, dhis2.metadata.processObject);
}