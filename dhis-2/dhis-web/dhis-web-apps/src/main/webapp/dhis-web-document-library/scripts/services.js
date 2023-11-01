/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var docLibraryServices = angular.module('docLibraryServices', ['ngResource'])

.factory('D2StorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2doclib",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['programs', 'optionSets', 'categoryCombos', 'attributes', 'ouLevels']
    });
    return{
        currentStore: store
    };
})

.service('PeriodService', function(CalendarService){

    this.getPeriods = function(periodType, periodOffset, futurePeriods){
        if(!periodType){
            return [];
        }

        var calendarSetting = CalendarService.getSetting();

        dhis2.period.format = calendarSetting.keyDateFormat;

        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );

        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );

        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );

        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, periodOffset );

        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, futurePeriods, null, null );

        angular.forEach(d2Periods, function(p){
            //p.endDate = DateUtils.formatFromApiToUser(p.endDate);
            //p.startDate = DateUtils.formatFromApiToUser(p.startDate);
            p.displayName = p.name;
            p.id = p.iso;
        });

        return d2Periods;
    };
})

/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, D2StorageService) {
    return {
        getAll: function(){

            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });
                });
            });

            return def.promise;
        },
        get: function(uid){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get('optionSets', uid).done(function(optionSet){
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


/* Factory to fetch programs */
.factory('ProgramFactory', function($q, $rootScope, D2StorageService, CommonUtils, orderByFilter) {

    return {
        get: function(uid){

            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get('programs', uid).done(function(ds){
                    $rootScope.$apply(function(){
                        def.resolve(ds);
                    });
                });
            });
            return def.promise;
        },
        getByOu: function(ou, selectedProgram){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('programs').done(function(prs){
                    var programs = [];
                    angular.forEach(prs, function(pr){
                        if ( pr.documentFolderType === 'general' || pr.documentFolderType === 'programme' ){
                            if(pr.organisationUnits.hasOwnProperty( ou.id ) && CommonUtils.userHasWriteAccess( 'ACCESSIBLE_PROGRAMS', 'programs' , pr.id)){
                                programs.push(pr);
                            }
                        }
                    });

                    programs = orderByFilter(programs, '-displayName').reverse();

                    if(programs.length === 0){
                        selectedProgram = null;
                    }
                    else if(programs.length === 1){
                        selectedProgram = programs[0];
                    }
                    else{
                        if(selectedProgram){
                            var continueLoop = true;
                            for(var i=0; i<programs.length && continueLoop; i++){
                                if(programs[i].id === selectedProgram.id){
                                    selectedProgram = programs[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedProgram = null;
                            }
                        }
                    }

                    if(!selectedProgram || angular.isUndefined(selectedProgram) && programs.legth > 0){
                        selectedProgram = programs[0];
                    }

                    $rootScope.$apply(function(){
                        def.resolve({programs: programs, selectedProgram: selectedProgram});
                    });
                });
            });
            return def.promise;
        }
    };
})


/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, D2StorageService, orderByFilter) {

    return {
        get: function(store, uid){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get(store, uid).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        set: function(store, obj){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.set(store, obj).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll(store).done(function(objs){
                    objs = orderByFilter(objs, '-displayName').reverse();
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });
            });
            return def.promise;
        },
        getByProperty: function(store, prop, val){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll(store).done(function(objs){
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

/* service for handling events */
.service('EventService', function($http, $q, DHIS2URL, CommonUtils, DateUtils, FileService, OptionSetService) {

    var bytesToSize = function ( bytes ){
        var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    };

    var skipPaging = "&skipPaging=true";

    var getByOrgUnitAndProgram = function(orgUnit, ouMode, program, typeDataElement, fileDataElement, optionSets, dataElementById){
        var url = DHIS2URL + '/events.json?' + 'orgUnit=' + orgUnit + '&ouMode='+ ouMode + '&program=' + program + skipPaging;

        /*if( startDate && endDate ){
            url += '&startDate=' + startDate + '&endDate=' + endDate;
        }

        if( attributeCategoryUrl && !attributeCategoryUrl.default ){
            url += '&attributeCc=' + attributeCategoryUrl.cc + '&attributeCos=' + attributeCategoryUrl.cp;
        }

        if( categoryOptionCombo ){
            url += '&coc=' + categoryOptionCombo;
        }*/

        var promise = $http.get( url ).then(function(response){
            var events = response.data && response.data.events ? response.data.events : [];
            var documents = [];
            if( response && response.data && response.data.events ){
                angular.forEach(events, function(ev){
                    var doc = {
                        dateUploaded: DateUtils.formatFromApiToUser(ev.eventDate),
                        uploadedBy: ev.storedBy,
                        event: ev.event
                    };

                    if( ev.dataValues ){
                        angular.forEach(ev.dataValues, function(dv){
                            if( dv.dataElement === typeDataElement.id ){
                                doc.folder = dv.value;
                            }
                            else if( dv.dataElement === fileDataElement.id ){
                                doc.value = dv.value;
                                FileService.get( dv.value ).then(function(res){
                                    doc.name = res.displayName || '';
                                    doc.size = bytesToSize( res.contentLength || 0 );
                                    doc.type = res.contentType || 'undefined';
                                    doc.path = '/events/files?dataElementUid=' + dv.dataElement + '&eventUid=' + ev.event;
                                });
                            }
                            else{
                                var val = dv.value;
                                var de = dataElementById[dv.dataElement];

                                if( de && de.optionSetValue ){
                                    val = OptionSetService.getName(optionSets[de.optionSet.id].options, String(val));
                                }

                                doc[dv.dataElement] = val;
                            }
                        });
                    }
                    documents.push( doc );
                });
            }
            return documents;

        }, function(response){
            CommonUtils.errorNotifier(response);
        });

        return promise;
    };

    var get = function(eventUid){
        var promise = $http.get(DHIS2URL + '/events/' + eventUid + '.json').then(function(response){
            return response.data;
        });
        return promise;
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
        create: create,
        deleteEvent: deleteEvent,
        update: update,
        getByOrgUnitAndProgram: getByOrgUnitAndProgram,
        getForMultipleOptionCombos: function( orgUnit, mode, pr, attributeCategoryUrl, optionCombos, startDate, endDate ){
            var def = $q.defer();
            var promises = [], events = [];
            angular.forEach(optionCombos, function(oco){
                promises.push( getByOrgUnitAndProgram( orgUnit, mode, pr, attributeCategoryUrl, oco.id, startDate, endDate) );
            });

            $q.all(promises).then(function( _events ){
                angular.forEach(_events, function(evs){
                    events = events.concat( evs );
                });

                def.resolve(events);
            });
            return def.promise;
        },
        getForMultiplePrograms: function( orgUnit, mode, programs, attributeCategoryUrl, startDate, endDate ){
            var def = $q.defer();
            var promises = [], events = [];
            angular.forEach(programs, function(pr){
                promises.push( getByOrgUnitAndProgram( orgUnit, mode, pr.id, attributeCategoryUrl, null, startDate, endDate) );
            });

            $q.all(promises).then(function( _events ){
                angular.forEach(_events, function(evs){
                    events = events.concat( evs );
                });

                def.resolve(events);
            });
            return def.promise;
        }
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
})

.service('OrgUnitService', function($http){
    var orgUnit, orgUnitPromise;
    return {
        get: function( uid, level ){
            if( orgUnit !== uid ){
                orgUnitPromise = $http.get( '../api/organisationUnits.json?filter=path:like:/' + uid + '&filter=level:le:' + level + '&fields=id,displayName,path,level,parent[id]&paging=false' ).then(function(response){
                    orgUnit = response.data.id;
                    return response.data;
                });
            }
            return orgUnitPromise;
        }
    };
})

/*Orgunit service for local db */
.service('IndexDBService', function($window, $q){

    var indexedDB = $window.indexedDB;
    var db = null;

    var open = function( dbName ){
        var deferred = $q.defer();

        var request = indexedDB.open( dbName );

        request.onsuccess = function(e) {
          db = e.target.result;
          deferred.resolve();
        };

        request.onerror = function(){
          deferred.reject();
        };

        return deferred.promise;
    };

    var get = function(storeName, uid){

        var deferred = $q.defer();

        if( db === null){
            deferred.reject("DB not opened");
        }
        else{
            var tx = db.transaction([storeName]);
            var store = tx.objectStore(storeName);
            var query = store.get(uid);

            query.onsuccess = function(e){
                deferred.resolve(e.target.result);
            };
        }
        return deferred.promise;
    };

    return {
        open: open,
        get: get
    };
});