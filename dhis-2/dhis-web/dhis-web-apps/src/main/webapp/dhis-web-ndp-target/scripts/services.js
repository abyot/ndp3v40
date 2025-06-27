/* global angular, moment, dhis2, parseFloat */
'use strict';

/* Services */

var ndpDataEntryServices = angular.module('ndpDataEntryServices', ['ngResource'])

.factory('NdpStorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2ndpde",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['dataSets', 'optionSets', 'categoryCombos', 'ouLevels', 'programs']
    });
    return{
        currentStore: store
    };
})

/* Context menu for grid*/
.service('SelectedMenuService', function () {
    this.selectedMenu = null;

    this.setSelectedMenu = function (selectedMenu) {
        this.selectedMenu = selectedMenu;
    };

    this.getSelectedMenu= function () {
        return this.selectedMenu;
    };
})

.service('PeriodService', function(CalendarService){

    this.getPeriods = function(periodType, periodOffset, futurePeriods){
        if(!periodType){
            return [];
        }

        var extractDate = function( obj ){
            return obj._year + '-' + obj._month + '-' + obj._day;
        };

        var calendarSetting = CalendarService.getSetting();

        dhis2.period.format = calendarSetting.keyDateFormat;

        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );

        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );

        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );

        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, periodOffset );

        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, futurePeriods, null, null );

        angular.forEach(d2Periods, function(p){
            p.endDate = extractDate(p._endDate);
            p.startDate = extractDate(p._startDate);
            p.displayName = p.name;
            p.id = p.iso;
        });

        return d2Periods;
    };
})


/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, NdpStorageService) {
    return {
        getAll: function(){

            var def = $q.defer();

            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });
                });
            });

            return def.promise;
        },
        get: function(uid){
            var def = $q.defer();

            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.get('optionSets', uid).done(function(optionSet){
                    $rootScope.$apply(function(){
                        def.resolve(optionSet);
                    });
                });
            });
            return def.promise;
        },
        getCode: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].displayName){
                        return options[i].code;
                    }
                }
            }
            return key;
        },
        getName: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].code){
                        return options[i].displayName;
                    }
                }
            }
            return key;
        }
    };
})

/* Service to fetch option combos */
.factory('OptionComboService', function($q, $rootScope, NdpStorageService) {
    return {
        getAll: function(){
            var def = $q.defer();
            var optionCombos = [];
            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        optionCombos = optionCombos.concat( cc.categoryOptionCombos );
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });
                });
            });

            return def.promise;
        },
        getMappedOptionCombos: function(){
            var def = $q.defer();
            var optionCombos = [];
            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll('categoryCombos').done(function(categoryCombos){
                    angular.forEach(categoryCombos, function(cc){
                        angular.forEach(cc.categoryOptionCombos, function(oco){
                            oco.categories = [];
                            angular.forEach(cc.categories, function(c){
                                oco.categories.push({id: c.id, displayName: c.displayName});
                            });
                            optionCombos[oco.id] = oco;
                        });
                    });
                    $rootScope.$apply(function(){
                        def.resolve(optionCombos);
                    });
                });
            });

            return def.promise;
        }
    };
})

/* Factory to fetch data sets */
.factory('DataSetFactory', function($q, $rootScope, NdpStorageService, orderByFilter, CommonUtils) {

    return {
        get: function(uid){

            var def = $q.defer();

            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.get('dataSets', uid).done(function(ds){
                    ds = CommonUtils.processDataSet( ds );
                    $rootScope.$apply(function(){
                        def.resolve(ds);
                    });
                });
            });
            return def.promise;
        },
        getByOu: function(ou, selectedDataSet){
            var def = $q.defer();

            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];
                    angular.forEach(dss, function(ds){
                        if(ds.id && ds.organisationUnits.indexOf( ou.id ) !== -1 && CommonUtils.userHasWriteAccess('ACCESSIBLE_DATASETS', 'dataSets', ds.id)){
                            dataSets.push(ds);
                        }
                    });

                    dataSets = orderByFilter(dataSets, '-displayName').reverse();

                    if(dataSets.length === 0){
                        selectedDataSet = null;
                    }
                    else if(dataSets.length === 1){
                        selectedDataSet = dataSets[0];
                    }
                    else{
                        if(selectedDataSet){
                            var continueLoop = true;
                            for(var i=0; i<dataSets.length && continueLoop; i++){
                                if(dataSets[i].id === selectedDataSet.id){
                                    selectedDataSet = dataSets[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedDataSet = null;
                            }
                        }
                    }

                    if(!selectedDataSet || angular.isUndefined(selectedDataSet) && dataSets.legth > 0){
                        selectedDataSet = dataSets[0];
                    }

                    $rootScope.$apply(function(){
                        def.resolve({dataSets: dataSets, selectedDataSet: selectedDataSet});
                    });
                });
            });
            return def.promise;
        },
        getByOuAndProperty: function(ou, selectedDataSet){
            var def = $q.defer();

            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll('dataSets').done(function(dss){
                    var dataSets = [];
                    angular.forEach(dss, function(ds){
                        if(ds.id && ds.organisationUnits.indexOf( ou.id ) !== -1 && CommonUtils.userHasWriteAccess('ACCESSIBLE_DATASETS', 'dataSets', ds.id) ){
                            //ds = CommonUtils.processDataSet( ds );
                            dataSets.push(ds);
                        }
                    });

                    dataSets = orderByFilter(dataSets, '-displayName').reverse();

                    if(dataSets.length === 0){
                        selectedDataSet = null;
                    }
                    else if(dataSets.length === 1){
                        selectedDataSet = dataSets[0];
                    }
                    else{
                        if(selectedDataSet){
                            var continueLoop = true;
                            for(var i=0; i<dataSets.length && continueLoop; i++){
                                if(dataSets[i].id === selectedDataSet.id){
                                    selectedDataSet = dataSets[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedDataSet = null;
                            }
                        }
                    }

                    if(!selectedDataSet || angular.isUndefined(selectedDataSet) && dataSets.legth > 0){
                        selectedDataSet = dataSets[0];
                    }

                    $rootScope.$apply(function(){
                        def.resolve({dataSets: dataSets, selectedDataSet: selectedDataSet});
                    });
                });
            });
            return def.promise;
        }
    };
})

/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, NdpStorageService, orderByFilter, SessionStorageService) {

    return {
        get: function(store, uid){
            var def = $q.defer();
            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.get(store, uid).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        set: function(store, obj){
            var def = $q.defer();
            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.set(store, obj).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll(store).done(function(objs){
                    objs = orderByFilter(objs, '-displayName').reverse();

                    if( store === 'categoryCombos' ){
                        var ocos = SessionStorageService.get('ACCESSIBLE_OPTION_COMBOS');
                        angular.forEach(objs, function(obj){
                            angular.forEach(obj.categoryOptionCombos, function(oco){
                                var _oco = ocos[oco.id];

                                if ( _oco ){
                                    oco.dWrite = _oco.dWrite;
                                    oco.dRead = _oco.dRead;
                                    oco.write = _oco.write;
                                    oco.read = _oco.read;
                                    if( _oco.hasAttachment ){
                                        oco.hasAttachment = _oco.hasAttachment;
                                    }
                                    if( _oco.dimensionType ){
                                        oco.dimensionType = _oco.dimensionType;
                                    }
                                }
                            });
                        });
                    }

                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });
            });
            return def.promise;
        },
        getByProperty: function(store, prop, val){
            var def = $q.defer();
            NdpStorageService.currentStore.open().done(function(){
                NdpStorageService.currentStore.getAll(store).done(function(objs){
                    var selectedObject = null;
                    for(var i=0; i<objs.length; i++){
                        if(objs[i][prop] ){
                            objs[i][prop] = objs[i][prop].toLocaleLowerCase();
                            if( objs[i][prop] === val )
                            {
                                selectedObject = objs[i];
                                break;
                            }
                        }
                    }

                    $rootScope.$apply(function(){
                        def.resolve(selectedObject);
                    });
                });
            });
            return def.promise;
        }
    };
})

.service('OrgUnitGroupSetService', function($http, CommonUtils){
    return {
        getSectors: function(){
            var filter = '?paging=false&fields=id,displayName,organisationUnitGroups[id,displayName,code,attributeValues[value,attribute[id,code,valueType]],organisationUnits[id,displayName,code,dataSets[dataSetElements[dataElement[dataElementGroups[groupSets[id]]]]]]],attributeValues[value,attribute[id,code,valueType]]';
            var url = dhis2.ndpde.apiUrl + '/organisationUnitGroupSets.json' + filter;
            var promise = $http.get( url ).then(function(response){
                var sectors = [];
                if( response && response.data && response.data.organisationUnitGroupSets){
                    var ogss = response.data.organisationUnitGroupSets;
                    angular.forEach(ogss, function(ogs){
                        ogs = dhis2.metadata.processMetaDataAttribute( ogs );
                        if( ogs.orgUnitGroupSetType && ogs.orgUnitGroupSetType === 'sector' && ogs.organisationUnitGroups.length > 0 ){
                            angular.forEach(ogs.organisationUnitGroups, function(og){
                                sectors.push( og );
                            });
                        }
                    });
                }
                return sectors;
            }, function(response){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        getMdas: function(){
            var filter = '?paging=false&fields=id,displayName,organisationUnitGroups[id,displayName,code,attributeValues[value,attribute[id,code,valueType]],organisationUnits[id,displayName,code,dataSets[dataSetElements[dataElement[dataElementGroups[groupSets[id]]]]]]],attributeValues[value,attribute[id,code,valueType]]';
            var url = dhis2.ndpde.apiUrl + '/organisationUnitGroupSets.json' + filter;
            var promise = $http.get( url ).then(function(response){
                var mdas = [];
                if( response && response.data && response.data.organisationUnitGroupSets){
                    var ogss = response.data.organisationUnitGroupSets;
                    angular.forEach(ogss, function(ogs){
                        ogs = dhis2.metadata.processMetaDataAttribute( ogs );
                        if( ogs.orgUnitGroupSetType && ogs.orgUnitGroupSetType === 'mdalg' && ogs.organisationUnitGroups.length > 0 ){
                            angular.forEach(ogs.organisationUnitGroups, function(og){
                                og = dhis2.metadata.processMetaDataAttribute( og );
                                if( og.orgUnitGroupType && og.orgUnitGroupType === 'mda' && og.organisationUnits){
                                    angular.forEach(og.organisationUnits, function(ou){
                                        mdas.push( ou.id );
                                    });
                                }
                            });
                        }
                    });
                }
                return mdas;
            }, function(response){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        getLgs: function(){
            var filter = '?paging=false&fields=id,displayName,organisationUnitGroups[id,displayName,code,attributeValues[value,attribute[id,code,valueType]],organisationUnits[id,displayName,code,dataSets[dataSetElements[dataElement[dataElementGroups[groupSets[id]]]]]]],attributeValues[value,attribute[id,code,valueType]]';
            var url = dhis2.ndpde.apiUrl + '/organisationUnitGroupSets.json' + filter;
            var promise = $http.get( url ).then(function(response){
                var lgs = [];
                if( response && response.data && response.data.organisationUnitGroupSets){
                    var ogss = response.data.organisationUnitGroupSets;
                    angular.forEach(ogss, function(ogs){
                        ogs = dhis2.metadata.processMetaDataAttribute( ogs );
                        if( ogs.orgUnitGroupSetType && ogs.orgUnitGroupSetType === 'mdalg' && ogs.organisationUnitGroups.length > 0 ){
                            angular.forEach(ogs.organisationUnitGroups, function(og){
                                og = dhis2.metadata.processMetaDataAttribute( og );
                                if( og.orgUnitGroupType && og.orgUnitGroupType === 'lg' && og.organisationUnits){
                                    angular.forEach(og.organisationUnits, function(ou){
                                        lgs.push( ou.id );
                                    });
                                }
                            });
                        }
                    });
                }
                return lgs;
            }, function(response){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        getByVote: function( id ){
            var filter = '?paging=false&fields=id,displayName,code,dataSets[dataSetElements[dataElement[dataElementGroups[groupSets[id]]]]],attributeValues[value,attribute[id,code,valueType]]';
            var url = dhis2.ndpde.apiUrl + '/organisationUnits/' + id + '.json' + filter;
            var promise = $http.get( url ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        }
    };
})

.service('Analytics', function($http, CommonUtils){
    return {
        getData: function( url ){
            url = dhis2.ndpde.apiUrl + '/analytics?' + url;
            var promise = $http.get( url ).then(function(response){
                var data = response.data;
                var reportData = [];
                if ( data && data.headers && data.headers.length > 0 && data.rows && data.rows.length > 0 ){
                    for(var i=0; i<data.rows.length; i++){
                        var r = {}, d = data.rows[i];
                        for(var j=0; j<data.headers.length; j++){

                            if ( data.headers[j].name === 'numerator' || data.headers[j].name === 'denominator' ){
                                d[j] = parseInt( d[j] );
                            }
                            else if( data.headers[j].name === 'value' ){
                                d[j] = parseFloat( d[j] );
                            }

                            r[data.headers[j].name] = d[j];
                        }

                        delete r.multiplier;
                        delete r.factor;
                        delete r.divisor;
                        reportData.push( r );
                    }
                }
                return {data: reportData, metaData: data.metaData};
            }, function(response){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        }
    };
})

.service('DataValueService', function($http, CommonUtils) {

    return {
        getDataValueSet: function( params ){
            var promise = $http.get('../api/dataValueSets.json?' + params ).then(function(response){
                return response.data;
            }, function( response ){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        saveDataValue: function( dv ){
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&cc='+dv.cc + '&cp='+dv.cp + '&value='+dv.value;

            var promise = $http.post('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        },
        saveComment: function( dv ){
            if( dv.comment ){
                dv.comment = encodeURI(dv.comment);
            }
            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&cc='+dv.cc + '&cp='+dv.cp + '&comment=' + dv.comment;
            var promise = $http.post('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        }
    };
})

.service('CompletenessService', function($http, CommonUtils) {

    return {
        get: function( ds, ou, startDate, endDate, children ){
            var promise = $http.get('../api/completeDataSetRegistrations?dataSet='+ds+'&orgUnit='+ou+'&startDate='+startDate+'&endDate='+endDate+'&children='+children).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        saveDsr: function( dsr ){
            var promise = $http.post('../api/completeDataSetRegistrations.json', dsr ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
                return response.data;
            });
            return promise;
        },
        save: function( ds, pe, ou, cc, cp, multiOu){
            var promise = $http.post('../api/completeDataSetRegistrations?ds='+ ds + '&pe=' + pe + '&ou=' + ou + '&cc=' + cc + '&cp=' + cp + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        delete: function( ds, pe, ou, cc, cp, multiOu){
            var promise = $http.delete('../api/completeDataSetRegistrations?ds='+ ds + '&pe=' + pe + '&ou=' + ou + '&cc=' + cc + '&cp=' + cp + '&multiOu=' + multiOu ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

/* service for handling events */
.service('EventService', function($q, $http, DHIS2URL, DateUtils, FileService) {

    var bytesToSize = function ( bytes ){
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    };

    var processDocuments = function(events ){
        var documents = {};
        if( events && events.length > 0 ){
            angular.forEach(events, function(ev){
                if( ev && ev.dataValues ){
                    var doc = {
                        dateUploaded: DateUtils.formatFromApiToUser(ev.eventDate),
                        uploadedBy: ev.storedBy,
                        event: ev.event
                    };

                    angular.forEach(ev.dataValues, function(dv){
                        if( dv.dataElement && dv.value ){
                            doc.value = dv.value;
                            FileService.get( dv.value ).then(function(res){
                                doc.name = res.displayName || '';
                                doc.size = bytesToSize( res.contentLength || 0 );
                                doc.type = res.contentType || 'undefined';
                                doc.path = '/events/files?dataElementUid=' + dv.dataElement + '&eventUid=' + ev.event;
                            });
                        }
                    });

                    documents[ev.event] = doc;
                }
            });
        }
        return documents;
    };

    var get = function(eventUid){
        var promise = $http.get(DHIS2URL + '/events/' + eventUid + '.json').then(function(response){
            return response.data;
        });
        return promise;
    };

    var getMultiple = function( eventIds ){
        var def = $q.defer();
        var promises = [];
        angular.forEach(eventIds, function(eventId){
            promises.push( get( eventId ) );
        });

        $q.all(promises).then(function( _events ){
            def.resolve( processDocuments(_events) );
        });
        return def.promise;
    };

    var create = function(dhis2Event){
        var promise = $http.post(DHIS2URL + '/events.json', dhis2Event).then(function(response){
            return response.data;
        });
        return promise;
    };

    var deleteEvent = function(dhis2Event){
        var promise = $http.delete(DHIS2URL + '/events/' + dhis2Event.event).then(function(response){
            return response.data;
        });
        return promise;
    };

    var update = function(dhis2Event){
        var promise = $http.put(DHIS2URL + '/events/' + dhis2Event.event, dhis2Event).then(function(response){
            return response.data;
        });
        return promise;
    };
    return {
        get: get,
        getMultiple: getMultiple,
        create: create,
        deleteEvent: deleteEvent,
        update: update
    };
})

/* Service for uploading/downloading file */
.service('FileService', function ($http, DHIS2URL) {

    return {
        get: function (uid) {
            var promise = $http.get(DHIS2URL + '/fileResources/' + uid).then(function (response) {
                return response.data;
            } ,function(error) {
                return null;
            });
            return promise;
        },
        download: function (fileName) {
            var promise = $http.get(fileName).then(function (response) {
                return response.data;
            }, function(error) {
                return null;
            });
            return promise;
        },
        upload: function(file){
            var formData = new FormData();
            formData.append('file', file);
            var headers = {transformRequest: angular.identity, headers: {'Content-Type': undefined}};
            var promise = $http.post(DHIS2URL + '/fileResources', formData, headers).then(function(response){
                return response.data;
            },function(error) {
               return null;
            });
            return promise;
        }
    };
});