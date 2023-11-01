
/* global dhis2, angular, selection, i18n_ajax_login_failed, _, Promise, await */

dhis2.util.namespace('dhis2.ndp');

// whether current user has any organisation units
dhis2.ndp.emptyOrganisationUnits = false;

dhis2.ndp.apiUrl = '../api';

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
dhis2.ndp.batchSize = 50;

dhis2.ndp.store = null;
dhis2.ndp.metaDataCached = dhis2.ndp.metaDataCached || false;
dhis2.ndp.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.ndp.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.ndp.store = new dhis2.storage.Store({
    name: 'dhis2ndp',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['dataElements', 'dataElementGroups', 'dataElementGroupSets', 'dataSets', 'optionSets', 'categoryCombos', 'attributes', 'ouLevels', 'programs', 'legendSets', 'categoryOptionGroupSets', 'optionGroups', 'optionGroupSets']
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
        if (dhis2.ndp.emptyOrganisationUnits) {
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
    if (dhis2.ndp.emptyOrganisationUnits) {
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
dhis2.ndp.downloadDataElements = function( dataElementType )
{
    var def = $.Deferred();
    dhis2.ndp.store.open().then(function(){
        getMetaDataElementsByType( dataElementType ).then(function( metaDes ){
            filterMissingDataElements(metaDes).then(function( missingDes ){
                getDataElements(missingDes).then(function(){
                    def.resolve();
                });
            });
        });
    });
    return def.promise();
};

dhis2.ndp.downloadGroupSets = function( code, groupSetType )
{
    var def = $.Deferred();
    dhis2.ndp.store.open().then(function(){
        getMetaDataElementGroupSetsByType( code, groupSetType ).then(function( metaDegs ){
            filterMissingDataElementGroupSets(metaDegs).then(function( missingDegs ){
                getDataElementGroupSets(missingDegs).then(function( degs ){
                    getDataElementGroups(degs).then(function( des ){
                        getDataElements(des).then(function(){
                            def.resolve();
                        });
                    });
                });
            });
        });
    });
    return def.promise();
};

dhis2.ndp.downloadMetaData = function()
{
    var metadataCached = JSON.parse(sessionStorage.getItem('METADATA_CACHED'));

    if ( metadataCached ){
        return Promise.resolve();
    }

    console.log('Loading required meta-data');

    return dhis2.ndp.store.open()

        .then( getUserAccessibleDataSets )
        .then( getUserAccessiblePrograms )

        //fetch option sets
        .then( getMetaOptionSets )
        .then( filterMissingOptionSets )
        .then( getOptionSets )

        //fetch category combos
        .then( getMetaCategoryCombos )
        .then( filterMissingCategoryCombos )
        .then( getCategoryCombos )

        //fetch custom attributes
        .then( getMetaAttributes )
        .then( filterMissingAttributes )
        .then( getAttributes )

        //fetch programs
        .then( getMetaPrograms )
        .then( filterMissingPrograms )
        .then( getPrograms )

        //fetch legendSets
        .then( getMetaLegendSets )
        .then( filterMissingLegendSets )
        .then( getLegendSets )

        //fetch categoryOptionGroupSets
        .then( getMetaCategoryOptionGroupSets )
        .then( filterMissingCategoryOptionGroupSets )
        .then( getCategoryOptionGroupSets )

        //fetch optionGroups
        .then( getMetaOptionGroups )
        .then( filterMissingOptionGroups )
        .then( getOptionGroups )

        //fetch optionGroupSets
        .then( getMetaOptionGroupSets )
        .then( filterMissingOptionGroupSets )
        .then( getOptionGroupSets );
};


dhis2.ndp.downloadAllMetaData = function()
{
    var metadataCached = JSON.parse(sessionStorage.getItem('ALL_METADATA_CACHED'));

    if ( metadataCached ){
        return Promise.resolve();
    }

    console.log('Loading required meta-data');

    return dhis2.ndp.store.open()

        .then( getUserAccessibleDataSets )
        .then( getUserAccessiblePrograms )
        .then( getOrgUnitLevels )
        .then( getSystemSetting )

        //fetch data elements
        .then( getMetaDataElements )
        .then( filterMissingDataElements )
        .then( getDataElements )

        //fetch data element groups
        .then( getMetaDataElementGroups )
        .then( filterMissingDataElementGroups )
        .then( getDataElementGroups )

        //fetch data element groupsets
        .then( getMetaDataElementGroupSets )
        .then( filterMissingDataElementGroupSets )
        .then( getDataElementGroupSets )

        //fetch data sets
        .then( getMetaDataSets )
        .then( filterMissingDataSets )
        .then( getDataSets )

        //fetch option sets
        .then( getMetaOptionSets )
        .then( filterMissingOptionSets )
        .then( getOptionSets )

        //fetch category combos
        .then( getMetaCategoryCombos )
        .then( filterMissingCategoryCombos )
        .then( getCategoryCombos )

        //fetch custom attributes
        .then( getMetaAttributes )
        .then( filterMissingAttributes )
        .then( getAttributes )

        //fetch programs
        .then( getMetaPrograms )
        .then( filterMissingPrograms )
        .then( getPrograms )

        //fetch legendSets
        .then( getMetaLegendSets )
        .then( filterMissingLegendSets )
        .then( getLegendSets )

        //fetch categoryOptionGroupSets
        .then( getMetaCategoryOptionGroupSets )
        .then( filterMissingCategoryOptionGroupSets )
        .then( getCategoryOptionGroupSets )

        //fetch optionGroups
        .then( getMetaOptionGroups )
        .then( filterMissingOptionGroups )
        .then( getOptionGroups );
};

function getUserAccessibleDataSets(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_DATASETS', dhis2.ndp.apiUrl + '/dataSets.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.ndp.store);
}

function getUserAccessiblePrograms(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_PROGRAMS', dhis2.ndp.apiUrl + '/programs.json', 'fields=id,access[data[read,write]],programStages[id,access[data[read,write]]]&paging=false', 'sessionStorage', dhis2.ndp.store);
}

function getOrgUnitLevels()
{
    dhis2.ndp.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', dhis2.ndp.apiUrl + '/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.ndp.store);
    });
}

function getSystemSetting(){
    if(localStorage['SYSTEM_SETTING']){
       return;
    }
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', dhis2.ndp.apiUrl + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms', '', 'localStorage', dhis2.ndp.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', dhis2.ndp.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.ndp.store, objs);
}

function getCategoryCombos( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'categoryCombos', 'categoryCombos', dhis2.ndp.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName,categoryOptions[displayName,id]],categories[id,displayName,code,dimension,dataDimensionType,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code,attributeValues[value,attribute[id,code,valueType]]]]', 'idb', dhis2.ndp.store);
}

function getLinkedMetaDataElements( dataElements ){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.ndp.apiUrl + '/dataElements.json', 'paging=false&fields=id,version');
}

function getMetaDataElementsByType( type ){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.ndp.apiUrl + '/dataElements.json', 'paging=false&fields=id,version&filter=attributeValues.value:eq:' + type );
}

function getMetaDataElements(){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.ndp.apiUrl + '/dataElements.json', 'paging=false&fields=id,version');
}

function filterMissingDataElements( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElements', dhis2.ndp.store, objs);
}

function getDataElements( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'dataElements', 'dataElements', dhis2.ndp.apiUrl + '/dataElements.json', 'paging=false&fields=id,code,displayName,aggregationType,shortName,description,formName,valueType,optionSetValue,optionSet[id],legendSets[id],attributeValues[value,attribute[id,name,valueType,code]],categoryCombo[id]', 'idb', dhis2.ndp.store);
}

function getMetaDataElementGroups(){
    return dhis2.metadata.getMetaObjectIds('dataElementGroups', dhis2.ndp.apiUrl + '/dataElementGroups.json', 'paging=false&fields=id,version');
}

function getLinkedMetaDataElementGroups( groups ){
    return dhis2.metadata.getMetaObjectIds('dataElementGroups', dhis2.ndp.apiUrl + '/dataElementGroups.json', 'paging=false&fields=id,version');
}

function filterMissingDataElementGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElementGroups', dhis2.ndp.store, objs);
}

function getDataElementGroups( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'dataElementGroups', 'dataElementGroups', dhis2.ndp.apiUrl + '/dataElementGroups.json', 'paging=false&fields=id,displayName,code,description,dataElements[id],attributeValues[value,attribute[id,name,valueType,code]]', 'idb', dhis2.ndp.store);
}

function getMetaDataElementGroupSetsByType( type, code ){
    var filter = '';

    if ( type !== '' ){
        filter += '&filter=attributeValues.value:eq:' + type;
    }

    if ( code !== '' ){
        filter += "&code:$ilike:" + code;
    }

    return dhis2.metadata.getMetaObjectIds('dataElementGroupSets', dhis2.ndp.apiUrl + '/dataElementGroupSets.json', 'paging=false&fields=id,version' + filter );
}

function getMetaDataElementGroupSets(){
    return dhis2.metadata.getMetaObjectIds('dataElementGroupSets', dhis2.ndp.apiUrl + '/dataElementGroupSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataElementGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElementGroupSets', dhis2.ndp.store, objs);
}

function getDataElementGroupSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'dataElementGroupSets', 'dataElementGroupSets', dhis2.ndp.apiUrl + '/dataElementGroupSets.json', 'paging=false&fields=id,code,description,displayName,dataElementGroups[id,displayName],attributeValues[value,attribute[id,name,valueType,code]]', 'idb', dhis2.ndp.store);
}

function getMetaDataSets(){
    return dhis2.metadata.getMetaObjectIds('dataSets', dhis2.ndp.apiUrl + '/dataSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataSets', dhis2.ndp.store, objs);
}

function getDataSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'dataSets', 'dataSets', dhis2.ndp.apiUrl + '/dataSets.json', 'paging=false&fields=id,periodType,displayName,version,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[code,id],dataSetElements[id,dataElement[id]]', 'idb', dhis2.ndp.store, '');
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', dhis2.ndp.apiUrl + '/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.ndp.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'optionSets', 'optionSets', dhis2.ndp.apiUrl + '/optionSets.json', 'paging=false&fields=id,displayName,code,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code,attributeValues[value,attribute[id,name,valueType,code]]]', 'idb', dhis2.ndp.store);
}

function getMetaIndicatorGroups(){
    return dhis2.metadata.getMetaObjectIds('indicatorGroups', dhis2.ndp.apiUrl + '/indicatorGroups.json', 'paging=false&fields=id,version');
}

function filterMissingIndicatorGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('indicatorGroups', dhis2.ndp.store, objs);
}

function getIndicatorGroups( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'indicatorGroups', 'indicatorGroups', dhis2.ndp.apiUrl + '/indicatorGroups.json', 'paging=false&fields=id,displayName,attributeValues[value,attribute[id,name,valueType,code]],indicators[id,displayName,denominatorDescription,numeratorDescription,dimensionItem,numerator,denominator,annualized,dimensionType,indicatorType[id,displayName,factor,number]]', 'idb', dhis2.ndp.store);
}

function getMetaAttributes(){
    return dhis2.metadata.getMetaObjectIds('attributes', dhis2.ndp.apiUrl + '/attributes.json', 'paging=false&fields=id,version');
}

function filterMissingAttributes( objs ){
    return dhis2.metadata.filterMissingObjIds('attributes', dhis2.ndp.store, objs);
}

function getAttributes( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'attributes', 'attributes', dhis2.ndp.apiUrl + '/attributes.json', 'paging=false&fields=:all,!access,!lastUpdatedBy,!lastUpdated,!created,!href,!user,!translations,!favorites,optionSet[id,displayName,code,options[id,displayName,code,sortOrder]]', 'idb', dhis2.ndp.store);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', dhis2.ndp.apiUrl + '/programs.json', 'paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.ndp.store, objs);
}

function getPrograms( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'programs', 'programs', dhis2.ndp.apiUrl + '/programs.json', 'paging=false&fields=*,programSections[sortOrder,displayName,trackedEntityAttributes],programTrackedEntityAttributes[*,trackedEntityAttribute[*,attributeValues[value,attribute[id,name,valueType,code]]]],categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id,level],programIndicators[id,displayName,analyticsType,expression],programStages[*,programStageDataElements[id,displayInReports,dataElement[*,attributeValues[value,attribute[id,name,valueType,code]]]]]', 'idb', dhis2.ndp.store, dhis2.metadata.processObject);
}

function getMetaLegendSets(){
    return dhis2.metadata.getMetaObjectIds('legendSets', dhis2.ndp.apiUrl + '/legendSets.json', 'paging=false&fields=id,version');
}

function filterMissingLegendSets( objs ){
    return dhis2.metadata.filterMissingObjIds('legendSets', dhis2.ndp.store, objs);
}

function getLegendSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'legendSets', 'legendSets', dhis2.ndp.apiUrl + '/legendSets.json', 'paging=false&fields=id,code,displayName,attributeValues[value,attribute[id,name,valueType,code]],legends[id,name,startValue,endValue,color]', 'idb', dhis2.ndp.store, dhis2.metadata.processObject);
}

function getMetaCategoryOptionGroupSets(){
    return dhis2.metadata.getMetaObjectIds('categoryOptionGroupSets', dhis2.ndp.apiUrl + '/categoryOptionGroupSets.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryOptionGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryOptionGroupSets', dhis2.ndp.store, objs);
}

function getCategoryOptionGroupSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'categoryOptionGroupSets', 'categoryOptionGroupSets', dhis2.ndp.apiUrl + '/categoryOptionGroupSets.json', 'paging=false&fields=id,code,displayName,attributeValues[value,attribute[id,name,valueType,code]],categoryOptionGroups[id,displayName,code,categoryOptions[id,displayName,code]]', 'idb', dhis2.ndp.store, dhis2.metadata.processObject);
}

function getMetaOptionGroups(){
    return dhis2.metadata.getMetaObjectIds('optionGroups', dhis2.ndp.apiUrl + '/optionGroups.json', 'paging=false&fields=id,version');
}

function filterMissingOptionGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('optionGroups', dhis2.ndp.store, objs);
}

function getOptionGroups( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'optionGroups', 'optionGroups', dhis2.ndp.apiUrl + '/optionGroups.json', 'fields=id,displayName,code,optionSet[id],options[id,displayName,code]', 'idb', dhis2.ndp.store, dhis2.metadata.processObject);
}

function getMetaOptionGroupSets(){
    return dhis2.metadata.getMetaObjectIds('optionGroupSets', dhis2.ndp.apiUrl + '/optionGroupSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionGroupSets', dhis2.ndp.store, objs);
}

function getOptionGroupSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.ndp.batchSize, 'optionGroupSets', 'optionGroupSets', dhis2.ndp.apiUrl + '/optionGroupSets.json', 'fields=id,displayName,code,optionSet[id],optionGroups[id,displayName,code,options[id,displayName,code]]', 'idb', dhis2.ndp.store, dhis2.metadata.processObject);
}