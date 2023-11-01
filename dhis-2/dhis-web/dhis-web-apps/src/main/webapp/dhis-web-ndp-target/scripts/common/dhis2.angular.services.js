/* Pagination service */
/* global angular, dhis2, moment */

var d2Services = angular.module('d2Services', ['ngResource'])

/* Factory for loading translation strings */
.factory('i18nLoader', function ($q, $http, SessionStorageService, DHIS2URL) {

    var getTranslationStrings = function (locale) {
        var defaultUrl = 'i18n/i18n_app.properties';
        var url = '';
        if (locale === 'en' || !locale) {
            url = defaultUrl;
        }
        else {
            url = 'i18n/i18n_app_' + locale + '.properties';
        }

        var tx = {locale: locale};

        var promise = $http.get(url).then(function (response) {
            tx = {locale: locale, keys: dhis2.util.parseJavaProperties(response.data)};
            return tx;
        }, function () {

            var p = $http.get(defaultUrl).then(function (response) {
                tx = {locale: locale, keys: dhis2.util.parseJavaProperties(response.data)};
                return tx;
            });
            return p;
        });
        return promise;
    };

    var getLocale = function () {
        var locale = 'en';

        var promise = $http.get( DHIS2URL + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms').then(function (response) {
            SessionStorageService.set('SYSTEM_SETTING', response.data);
            if (response.data && response.data.settings && response.data.keyUiLocale) {
                locale = response.data.keyUiLocale;
            }
            return locale;
        }, function () {
            return locale;
        });

        return promise;
    };
    return function () {
        var deferred = $q.defer(), translations;
        var userProfile = SessionStorageService.get('SYSTEM_SETTING');
        if (userProfile && userProfile.keyUiLocale) {
            getTranslationStrings(userProfile.keyUiLocale).then(function (response) {
                translations = response.keys;
                deferred.resolve(translations);
            });
            return deferred.promise;
        }
        else {
            getLocale().then(function (locale) {
                getTranslationStrings(locale).then(function (response) {
                    translations = response.keys;
                    deferred.resolve(translations);
                });
            });
            return deferred.promise;
        }
    };
})

.service('AuthorityService', function () {
    var getAuthorities = function (roles) {
        var authority = {};
        if (roles && roles.userCredentials && roles.userCredentials.userRoles) {
            angular.forEach(roles.userCredentials.userRoles, function (role) {
                angular.forEach(role.authorities, function (auth) {
                    authority[auth] = true;
                });
            });
        }
        return authority;
    };

    return {
        getUserAuthorities: function (roles) {
            var auth = getAuthorities(roles);
            var authority = {};
            authority.canDeleteEvent = auth['F_TRACKED_ENTITY_DATAVALUE_DELETE'] || auth['ALL'] ? true : false;
            authority.canAddOrUpdateEvent = auth['F_TRACKED_ENTITY_DATAVALUE_ADD'] || auth['ALL'] ? true : false;
            authority.canSearchTei = auth['F_TRACKED_ENTITY_INSTANCE_SEARCH'] || auth['ALL'] ? true : false;
            authority.canDeleteTei = auth['F_TRACKED_ENTITY_INSTANCE_DELETE'] || auth['ALL'] ? true : false;
            authority.canRegisterTei = auth['F_TRACKED_ENTITY_INSTANCE_ADD'] || auth['ALL'] ? true : false;
            authority.canEnrollTei = auth['F_PROGRAM_ENROLLMENT'] || auth['ALL'] ? true : false;
            authority.canUnEnrollTei = auth['F_PROGRAM_UNENROLLMENT'] || auth['ALL'] ? true : false;
            authority.canAdministerDashboard = auth['F_PROGRAM_DASHBOARD_CONFIG_ADMIN'] || auth['ALL'] ? true : false;
            return authority;
        }
    };
})

/* Factory for loading external data */
.factory('ExternalDataFactory', function ($http) {

    return {
        get: function (fileName) {
            var promise = $http.get(fileName).then(function (response) {
                return response.data;
            });
            return promise;
        }
    };
})

/* service for wrapping sessionStorage '*/
.service('SessionStorageService', function ($window) {
    return {
        get: function (key) {
            return JSON.parse($window.sessionStorage.getItem(key));
        },
        set: function (key, obj) {
            $window.sessionStorage.setItem(key, JSON.stringify(obj));
        },
        clearAll: function () {
            for (var key in $window.sessionStorage) {
                $window.sessionStorage.removeItem(key);
            }
        }
    };
})

/* service for getting calendar setting */
.service('CalendarService', function (storage, $rootScope) {

    return {
        getSetting: function () {

            var dhis2CalendarFormat = {keyDateFormat: 'yyyy-MM-dd', keyCalendar: 'gregorian', momentFormat: 'YYYY-MM-DD'};
            var storedFormat = storage.get('SYSTEM_SETTING');
            if (angular.isObject(storedFormat) && storedFormat.keyDateFormat && storedFormat.keyCalendar) {
                if (storedFormat.keyCalendar === 'iso8601') {
                    storedFormat.keyCalendar = 'gregorian';
                }

                if (storedFormat.keyDateFormat === 'dd-MM-yyyy') {
                    dhis2CalendarFormat.momentFormat = 'DD-MM-YYYY';
                }

                dhis2CalendarFormat.keyCalendar = storedFormat.keyCalendar;
                dhis2CalendarFormat.keyDateFormat = storedFormat.keyDateFormat;
            }
            $rootScope.dhis2CalendarFormat = dhis2CalendarFormat;
            return dhis2CalendarFormat;
        }
    };
})

/* service for dealing with dates */
.service('DateUtils', function ($filter, CalendarService) {

    return {
        getDate: function (dateValue) {
            if (!dateValue) {
                return;
            }
            var calendarSetting = CalendarService.getSetting();
            dateValue = moment(dateValue, calendarSetting.momentFormat)._d;
            return Date.parse(dateValue);
        },
        format: function (dateValue) {
            if (!dateValue) {
                return;
            }

            var calendarSetting = CalendarService.getSetting();
            dateValue = moment(dateValue, calendarSetting.momentFormat)._d;
            dateValue = $filter('date')(dateValue, calendarSetting.keyDateFormat);
            return dateValue;
        },
        formatToHrsMins: function (dateValue) {
            var calendarSetting = CalendarService.getSetting();
            var dateFormat = 'YYYY-MM-DD @ hh:mm A';
            if (calendarSetting.keyDateFormat === 'dd-MM-yyyy') {
                dateFormat = 'DD-MM-YYYY @ hh:mm A';
            }
            return moment(dateValue).format(dateFormat);
        },
        formatToHrsMinsSecs: function (dateValue) {
            var calendarSetting = CalendarService.getSetting();
            var dateFormat = 'YYYY-MM-DD @ hh:mm:ss A';
            if (calendarSetting.keyDateFormat === 'dd-MM-yyyy') {
                dateFormat = 'DD-MM-YYYY @ hh:mm:ss A';
            }
            return moment(dateValue).format(dateFormat);
        },

        getToday: function () {
            var calendarSetting = CalendarService.getSetting();
            var tdy = $.calendars.instance(calendarSetting.keyCalendar).newDate();
            var today = moment(tdy._year + '-' + tdy._month + '-' + tdy._day, 'YYYY-MM-DD')._d;
            today = Date.parse(today);
            today = $filter('date')(today, calendarSetting.keyDateFormat);
            return today;
        },
        formatFromUserToApi: function (dateValue) {
            if (!dateValue) {
                return;
            }
            var calendarSetting = CalendarService.getSetting();
            dateValue = moment(dateValue, calendarSetting.momentFormat)._d;
            dateValue = Date.parse(dateValue);
            dateValue = $filter('date')(dateValue, 'yyyy-MM-dd');
            return dateValue;
        },
        formatFromApiToUser: function (dateValue) {
            if (!dateValue) {
                return;
            }
            var calendarSetting = CalendarService.getSetting();
            if (moment(dateValue, calendarSetting.momentFormat).format(calendarSetting.momentFormat) === dateValue) {
                return dateValue;
            }
            dateValue = moment(dateValue, 'YYYY-MM-DD')._d;
            return $filter('date')(dateValue, calendarSetting.keyDateFormat);
        },
        getDateAfterOffsetDays: function (offSetDays) {
            var date = new Date();
            date.setDate(date.getDate()+offSetDays);
            var calendarSetting = CalendarService.getSetting();
            var tdy = $.calendars.instance(calendarSetting.keyCalendar).fromJSDate(date);
            var dateAfterOffset = moment(tdy._year + '-' + tdy._month + '-' + tdy._day, 'YYYY-MM-DD')._d;
            dateAfterOffset = Date.parse(dateAfterOffset);
            dateAfterOffset = $filter('date')(dateAfterOffset, calendarSetting.keyDateFormat);
            return dateAfterOffset;
        }
    };
})

/* Service for option name<->code conversion */
.factory('OptionSetService', function() {
    return {
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

/* service for common utils */
.service('CommonUtils', function($translate, SessionStorageService, DateUtils, OptionSetService, CurrentSelection, FileService, DialogService){

    return {
        formatDataValue: function( de, val, optionSets, destination ){

            if( de.optionSetValue ){
                if(destination === 'USER'){
                    val = OptionSetService.getName(optionSets[de.optionSet.id].options, String(val));
                }
                else{
                    val = OptionSetService.getCode(optionSets[de.optionSet.id].options, val);
                }
            }
            else{
                if( val ){
                    if( de.valueType === 'NUMBER' && dhis2.validation.isNumber(val) ){
                        val = parseFloat( val );
                    }
                    else if( dhis2.validation.isNumber(val) &&
                            de.valueType === 'INTEGER' ||
                            de.valueType === 'INTEGER_POSITIVE' ||
                            de.valueType === 'INTEGER_NEGATIVE' ||
                            de.valueType === 'INTEGER_ZERO_OR_POSITIVE' ||
							de.valueType === 'PERCENTAGE'){
                        val = parseInt( val );
                    }
                    else if(de.valueType=== 'TRUE_ONLY'){
                        val = val === 'true' ? true: '';
                    }
                    else if(de.valueType=== 'BOOLEAN'){
                        val = val === 'true' || val === true ? true : val === 'false' || val === false ? false : '';
                    }
                }
            }

            return val;
        },
        displayBooleanAsYesNo: function(value, dataElement){
            if(angular.isUndefined(dataElement) || dataElement.valueType === "BOOLEAN"){
                if(value === "true" || value === true){
                    return "Yes";
                }
                else if(value === "false" || value === false){
                    return "No";
                }
            }
            return value;
        },
        userHasValidRole: function(obj, prop, userRoles){
        	if( !obj || !prop || !userRoles){
                return false;
        	}
        	for(var i=0; i < userRoles.length; i++){
                if( userRoles[i].authorities && userRoles[i].authorities.indexOf('ALL') !== -1 ){
                    return true;
                }
                if( userRoles[i][prop] && userRoles[i][prop].length > 0 ){
                    for( var j=0; j< userRoles[i][prop].length; j++){
                        if( obj.id === userRoles[i][prop][j].id ){
                            return true;
                        }
                    }
                }
            }
            return false;
        },
        userHasAuthority: function( auth ){
            var userInfo = SessionStorageService.get('USER_PROFILE');
            if ( userInfo && userInfo.authorities ){
                if ( userInfo.authorities.indexOf(auth) !== -1 || userInfo.authorities.indexOf('ALL') !== -1 ){
                    return true;
                }
            }
            return false;
        },
        userHasWriteAccess: function( storage, object, objectId ){
            var objs = SessionStorageService.get(storage);
            objs = objs[object];
            if (objs && objs.length) {
                for (var i = 0; i < objs.length; i++) {
                    if (objs[i].id === objectId && objs[i].access && objs[i].access.data && objs[i].access.data.write) {
                        return true;
                    }
                }
            }
            return false;
        },
        /*userHasWriteAccess: function( dataSetId ){
            var dataSets = SessionStorageService.get('ACCESSIBLE_DATASETS');
            dataSets = dataSets.dataSets;
            if (dataSets && dataSets.length) {
                for (var i = 0; i < dataSets.length; i++) {
                    if (dataSets[i].id === dataSetId && dataSets[i].access && dataSets[i].access.data && dataSets[i].access.data.write) {
                        return true;
                    }
                }
            }
            return false;
        },*/
        getUsername: function(){
            var userProfile = SessionStorageService.get('USER_PROFILE');
            var username = userProfile && userProfile.userCredentials && userProfile.userCredentials.username ? userProfile.userCredentials.username : '';
            return username;
        },
        getSum: function( op1, op2 ){
            op1 = dhis2.validation.isNumber(op1) ? parseInt(op1) : 0;
            op2 = dhis2.validation.isNumber(op2) ? parseInt(op2) : 0;
            return op1 + op2;
        },
        getPercent: function(op1, op2){
            op1 = dhis2.validation.isNumber(op1) ? parseInt(op1) : 0;
            op2 = dhis2.validation.isNumber(op2) ? parseInt(op2) : 0;
            if( op1 === 0){
                return "";
            }
            if( op2 === 0 ){
                return $translate.instant('missing_target');
            }
            return parseFloat((op1 / op2)*100).toFixed(2) + '%';
        },
        getRoleHeaders: function(){
            var headers = [];
            headers.push({id: 'catalyst', displayName: $translate.instant('catalyst')});
            headers.push({id: 'funder', displayName: $translate.instant('funder')});
            headers.push({id: 'responsibleMinistry', displayName: $translate.instant('responsible_ministry')});

            return headers;
        },
        getOptionComboIdFromOptionNames: function(optionComboMap, options){

            var optionNames = [];
            angular.forEach(options, function(op){
                optionNames.push(op.displayName);
            });

            var selectedAttributeOcboName = optionNames.join();
            //selectedAttributeOcboName = selectedAttributeOcboName.replace(/\,/g, ', ');
            var selectedAttributeOcobo = optionComboMap['"' + selectedAttributeOcboName + '"'];

            if( !selectedAttributeOcobo || angular.isUndefined( selectedAttributeOcobo ) ){
                selectedAttributeOcboName = optionNames.reverse().join();
                //selectedAttributeOcboName = selectedAttributeOcboName.replace(",", ", ");
                selectedAttributeOcobo = optionComboMap['"' + selectedAttributeOcboName + '"'];
            }

            return selectedAttributeOcobo;
        },
        splitRoles: function( roles ){
            return roles.split(",");
        },
        pushRoles: function(existingRoles, roles){
            angular.forEach(roles, function(r){
                if( existingRoles.indexOf(r) === -1 ){
                    existingRoles.push(r);
                }
            });
            return existingRoles;
        },
        extractRoles: function(existingRoles, roles){

            return existingRoles;
        },
        getOptionIds: function(options){
            var optionNames = '';
            angular.forEach(options, function(o){
                optionNames += o.id + ';';
            });

            return optionNames.slice(0,-1);
        },
        notify: function(header, body){
            var dialogOptions = {
                headerText: $translate.instant(header),
                bodyText: $translate.instant(body)
            };
            DialogService.showDialog({}, dialogOptions);
        },
        errorNotifier: function(response){
            if( response && response.data && response.data.status === 'ERROR'){
                var dialogOptions = {
                    headerText: response.data.status,
                    bodyText: response.data.message ? response.data.message : $translate.instant('unable_to_fetch_data_from_server')
                };
                DialogService.showDialog({}, dialogOptions);
            }
        },
        getNumeratorAndDenominatorIds: function( ind ){
            var expressionRegx = /[#\{\}]/g;
            var num = ind.numerator.replace(expressionRegx, '');
            var den = ind.denominator.replace(expressionRegx, '');

            if( num.indexOf('.') === -1 ){
                num = num + '.HllvX50cXC0';
            }
            num = num.split('.');

            if( den.indexOf('.') === -1 ){
                den = den + '.HllvX50cXC0';
            }
            den = den.split('.');
            return {numerator: num[0], numeratorOptionCombo: num[1], denominator: den[0], denominatorOptionCombo: den[1]};
        },
        getStakeholderCategoryFromDataSet: function(dataSet, availableCombos, existingCategories, categoryIds){
            if( dataSet.categoryCombo && dataSet.categoryCombo.id){
                var cc = availableCombos[dataSet.categoryCombo.id];
                if( cc && cc.categories ){
                    angular.forEach(cc.categories, function(c){
                        if( c.code === 'FI' && categoryIds.indexOf( c.id )){
                            existingCategories.push( c );
                            categoryIds.push( c.id );
                        }
                    });
                }
            }
            return {categories: existingCategories, categoryIds: categoryIds};
        },
        getDMCategoryFromDataSet: function(dataSet, availableCombos, existingCategories, categoryIds){
            if( dataSet.categoryCombo && dataSet.categoryCombo.id){
                var cc = availableCombos[dataSet.categoryCombo.id];
                if( cc && cc.categories ){
                    angular.forEach(cc.categories, function(c){
                        if( c.code === 'DM' && categoryIds.indexOf( c.id )){
                            existingCategories.push( c );
                            categoryIds.push( c.id );
                        }
                    });
                }
            }
            return {categories: existingCategories, categoryIds: categoryIds};
        },
        getRequiredCols: function(availableRoles, selectedRole){
            var cols = [];
            for (var k in availableRoles[selectedRole.id]){
                if ( availableRoles[selectedRole.id].hasOwnProperty(k) ) {
                    angular.forEach(availableRoles[selectedRole.id][k], function(c){
                        c = c.trim();
                        if( cols.indexOf( c ) === -1 ){
                            c = c.trim();
                            if( selectedRole.domain === 'CA' ){
                                if( selectedRole.categoryOptions && selectedRole.categoryOptions.indexOf( c ) !== -1){
                                    cols.push( c );
                                }
                            }
                            else{
                                cols.push( c );
                            }
                        }
                    });
                }
            }
            return cols.sort();
        },
        populateOuLevels: function( orgUnit, ouLevels, lowestLevel ){
            var ouModes = [{displayName: $translate.instant('selected_level') , value: 'SELECTED', level: orgUnit.l}];
            for( var i=orgUnit.l+1; i<=lowestLevel; i++ ){
                var lvl = ouLevels[i];
                ouModes.push({value: lvl, displayName: lvl, level: i});
            }
            var selectedOuMode = ouModes[0];
            return {ouModes: ouModes, selectedOuMode: selectedOuMode};
        },
        processDataSet: function( ds ){
            var dataElements = [];
            angular.forEach(ds.dataSetElements, function(dse){
                if( dse.dataElement ){
                    dataElements.push( dhis2.metadata.processMetaDataAttribute( dse.dataElement ) );
                }
            });
            ds.dataElements = dataElements;
            delete ds.dataSetElements;

            return ds;
        },
        getReportName: function(reportType, reportRole, ouName, ouLevel, peName){
            var reportName = ouName;
            if( ouLevel && ouLevel.value && ouLevel.value !== 'SELECTED' ){
                reportName += ' (' + ouLevel.displayName + ') ';
            }

            reportName += ' - ' + reportType;

            if( reportRole && reportRole.displayNme ){
                reportName += ' (' + reportRole.displayName + ')';
            }

            reportName += ' - ' + peName + '.xls';
            return reportName;
        },
        getStakeholderNames: function(){
            var stakeholders = [{id: 'CA_ID', displayName: $translate.instant('catalyst')},{id: 'FU_ID', displayName: $translate.instant('funder')},{id: 'RM_ID', displayName: $translate.instant('responsible_ministry')}];
            return stakeholders;
        },
        getDataElementTotal: function(dataValues, dataElement){
            if( dataValues[dataElement] ){
                dataValues[dataElement].total = 0;
                angular.forEach(dataValues[dataElement], function(val, key){
                    if( key !== 'total' && val && val.value && dhis2.validation.isNumber( val.value ) ){
                        dataValues[dataElement].total += parseInt( val.value );
                    }
                });
            }
            return dataValues[dataElement];
        },
        getIndicatorResult: function( ind, dataValues ){
            var denVal = 1, numVal = 0;

            if( ind.numerator ) {

                ind.numExpression = angular.copy( ind.numerator );
                var matcher = ind.numExpression.match( dhis2.metadata.formulaRegex );

                for ( var k in matcher )
                {
                    var match = matcher[k];

                    // Remove brackets from expression to simplify extraction of identifiers

                    var operand = match.replace( dhis2.metadata.operatorRegex, '' );

                    var isTotal = !!( operand.indexOf( dhis2.metadata.custSeparator ) == -1 );

                    var value = '0';

                    if ( isTotal )
                    {
                        if( dataValues && dataValues[operand] && dataValues[operand].total ){
                            value = dataValues[operand].total;
                        }
                    }
                    else
                    {
                        var de = operand.substring( 0, operand.indexOf( dhis2.metadata.custSeparator ) );
                        var coc = operand.substring( operand.indexOf( dhis2.metadata.custSeparator ) + 1, operand.length );

                        if( dataValues &&
                                dataValues[de] &&
                                dataValues[de][coc] &&
                                dataValues[de][coc].value){
                            value = dataValues[de][coc].value;
                        }
                    }
                    ind.numExpression = ind.numExpression.replace( match, value );
                }
            }


            if( ind.denominator ) {

                ind.denExpression = angular.copy( ind.denominator );
                var matcher = ind.denExpression.match( dhis2.metadata.formulaRegex );

                for ( var k in matcher )
                {
                    var match = matcher[k];

                    // Remove brackets from expression to simplify extraction of identifiers

                    var operand = match.replace( dhis2.metadata.operatorRegex, '' );

                    var isTotal = !!( operand.indexOf( dhis2.metadata.custSeparator ) == -1 );

                    var value = '0';

                    if ( isTotal )
                    {
                        if( dataValues[operand] && dataValues[operand].total ){
                            value = dataValues[operand].total;
                        }
                    }
                    else
                    {
                        var de = operand.substring( 0, operand.indexOf( dhis2.metadata.custSeparator ) );
                        var coc = operand.substring( operand.indexOf( dhis2.metadata.custSeparator ) + 1, operand.length );

                        if( dataValues &&
                                dataValues[de] &&
                                dataValues[de][coc] &&
                                dataValues[de][coc].value){
                            value = dataValues[de][coc].value;
                        }
                    }
                    ind.denExpression = ind.denExpression.replace( match, value );
                }
            }

            if( ind.numExpression ){
                numVal = eval( ind.numExpression );
                numVal = isNaN( numVal ) ? '-' : roundTo( numVal, 1 );
            }

            if( ind.denExpression ){
                denVal = eval( ind.denExpression );
                denVal = isNaN( denVal ) ? '-' : roundTo( denVal, 1 );
            }

            var factor = 1;

            /*if( ind.indicatorType && ind.indicatorType.factor ){
                factor = ind.indicatorType.factor;
            }*/

            return (numVal / denVal)*factor;
        },
    };
})


/* Context menu for grid*/
.service('ContextMenuSelectedItem', function () {
    this.selectedItem = '';

    this.setSelectedItem = function (selectedItem) {
        this.selectedItem = selectedItem;
    };

    this.getSelectedItem = function () {
        return this.selectedItem;
    };
})

/* Modal service for user interaction */
.service('ModalService', ['$modal', function ($modal) {

    var modalDefaults = {
        backdrop: true,
        keyboard: true,
        modalFade: true,
        templateUrl: 'views/modal.html'
    };

    var modalOptions = {
        closeButtonText: 'Close',
        actionButtonText: 'OK',
        headerText: 'Proceed?',
        bodyText: 'Perform this action?'
    };

    this.showModal = function (customModalDefaults, customModalOptions) {
        if (!customModalDefaults)
            customModalDefaults = {};
        customModalDefaults.backdrop = 'static';
        return this.show(customModalDefaults, customModalOptions);
    };

    this.show = function (customModalDefaults, customModalOptions) {
        //Create temp objects to work with since we're in a singleton service
        var tempModalDefaults = {};
        var tempModalOptions = {};

        //Map angular-ui modal custom defaults to modal defaults defined in service
        angular.extend(tempModalDefaults, modalDefaults, customModalDefaults);

        //Map modal.html $scope custom properties to defaults defined in service
        angular.extend(tempModalOptions, modalOptions, customModalOptions);

        if (!tempModalDefaults.controller) {
            tempModalDefaults.controller = function ($scope, $modalInstance) {
                $scope.modalOptions = tempModalOptions;
                $scope.modalOptions.ok = function (result) {
                    $modalInstance.close(result);
                };
                $scope.modalOptions.close = function (result) {
                    $modalInstance.dismiss('cancel');
                };
            };
        }

        return $modal.open(tempModalDefaults).result;
    };

}])

/* Dialog service for user interaction */
.service('DialogService', ['$modal', function ($modal) {

    var dialogDefaults = {
        backdrop: true,
        keyboard: true,
        backdropClick: true,
        modalFade: true,
        templateUrl: 'views/dialog.html'
    };

    var dialogOptions = {
        closeButtonText: 'close',
        actionButtonText: 'ok',
        headerText: 'dhis2_tracker',
        bodyText: 'Perform this action?'
    };

    this.showDialog = function (customDialogDefaults, customDialogOptions) {
        if (!customDialogDefaults)
            customDialogDefaults = {};
        customDialogDefaults.backdropClick = false;
        return this.show(customDialogDefaults, customDialogOptions);
    };

    this.show = function (customDialogDefaults, customDialogOptions) {
        //Create temp objects to work with since we're in a singleton service
        var tempDialogDefaults = {};
        var tempDialogOptions = {};

        //Map angular-ui modal custom defaults to modal defaults defined in service
        angular.extend(tempDialogDefaults, dialogDefaults, customDialogDefaults);

        //Map modal.html $scope custom properties to defaults defined in service
        angular.extend(tempDialogOptions, dialogOptions, customDialogOptions);

        if (!tempDialogDefaults.controller) {
            tempDialogDefaults.controller = function ($scope, $modalInstance) {
                $scope.dialogOptions = tempDialogOptions;
                $scope.dialogOptions.ok = function (result) {
                    $modalInstance.close(result);
                };
            };
        }

        return $modal.open(tempDialogDefaults).result;
    };

}])
.service('NotificationService', function (DialogService) {
    this.showNotifcationDialog = function(errorMsgheader, errorMsgBody){
        var dialogOptions = {
            headerText: errorMsgheader,
            bodyText: errorMsgBody
        };
        DialogService.showDialog({}, dialogOptions);
    };

    this.showNotifcationWithOptions = function(dialogDefaults, dialogOptions){
        DialogService.showDialog(dialogDefaults, dialogOptions);
    };

})
.service('Paginator', function () {
    this.page = 1;
    this.pageSize = 50;
    this.itemCount = 0;
    this.pageCount = 0;
    this.toolBarDisplay = 5;

    this.setPage = function (page) {
        if (page > this.getPageCount()) {
            return;
        }

        this.page = page;
    };

    this.getPage = function () {
        return this.page;
    };

    this.setPageSize = function (pageSize) {
        this.pageSize = pageSize;
    };

    this.getPageSize = function () {
        return this.pageSize;
    };

    this.setItemCount = function (itemCount) {
        this.itemCount = itemCount;
    };

    this.getItemCount = function () {
        return this.itemCount;
    };

    this.setPageCount = function (pageCount) {
        this.pageCount = pageCount;
    };

    this.getPageCount = function () {
        return this.pageCount;
    };

    this.setToolBarDisplay = function (toolBarDisplay) {
        this.toolBarDisplay = toolBarDisplay;
    };

    this.getToolBarDisplay = function () {
        return this.toolBarDisplay;
    };

    this.lowerLimit = function () {
        var pageCountLimitPerPageDiff = this.getPageCount() - this.getToolBarDisplay();

        if (pageCountLimitPerPageDiff < 0) {
            return 0;
        }

        if (this.getPage() > pageCountLimitPerPageDiff + 1) {
            return pageCountLimitPerPageDiff;
        }

        var low = this.getPage() - (Math.ceil(this.getToolBarDisplay() / 2) - 1);

        return Math.max(low, 0);
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

/* current selections */
.service('CurrentSelection', function(){
    this.currentSelection = {};
    this.relationshipInfo = {};
    this.optionSets = null;
    this.attributesById = null;
    this.ouLevels = null;
    this.sortedTeiIds = [];
    this.selectedTeiEvents = null;
    this.relationshipOwner = {};
    this.selectedTeiEvents = [];
    this.fileNames = [];
    this.location = null;
    this.advancedSearchOptions = null;
	this.trackedEntities = null;

    this.set = function(currentSelection){
        this.currentSelection = currentSelection;
    };
    this.get = function(){
        return this.currentSelection;
    };

    this.setRelationshipInfo = function(relationshipInfo){
        this.relationshipInfo = relationshipInfo;
    };
    this.getRelationshipInfo = function(){
        return this.relationshipInfo;
    };

    this.setOptionSets = function(optionSets){
        this.optionSets = optionSets;
    };
    this.getOptionSets = function(){
        return this.optionSets;
    };

    this.setAttributesById = function(attributesById){
        this.attributesById = attributesById;
    };
    this.getAttributesById = function(){
        return this.attributesById;
    };

    this.setOuLevels = function(ouLevels){
        this.ouLevels = ouLevels;
    };
    this.getOuLevels = function(){
        return this.ouLevels;
    };

    this.setSortedTeiIds = function(sortedTeiIds){
        this.sortedTeiIds = sortedTeiIds;
    };
    this.getSortedTeiIds = function(){
        return this.sortedTeiIds;
    };

    this.setSelectedTeiEvents = function(selectedTeiEvents){
        this.selectedTeiEvents = selectedTeiEvents;
    };
    this.getSelectedTeiEvents = function(){
        return this.selectedTeiEvents;
    };

    this.setRelationshipOwner = function(relationshipOwner){
        this.relationshipOwner = relationshipOwner;
    };
    this.getRelationshipOwner = function(){
        return this.relationshipOwner;
    };

    this.setFileNames = function(fileNames){
        this.fileNames = fileNames;
    };
    this.getFileNames = function(){
        return this.fileNames;
    };

    this.setLocation = function(location){
        this.location = location;
    };
    this.getLocation = function(){
        return this.location;
    };

    this.setAdvancedSearchOptions = function (searchOptions) {
        this.advancedSearchOptions = searchOptions;
    };
    this.getAdvancedSearchOptions = function () {
        return this.advancedSearchOptions;
    };

    this.setTrackedEntities = function (trackedEntities) {
        this.trackedEntities = trackedEntities;
    };
    this.getTrackedEntities = function () {
        return this.trackedEntities;
    };

    this.setSortColumn = function (sortColumn) {
        if (this.advancedSearchOptions) {
            this.advancedSearchOptions.sortColumn = sortColumn;
        }
    };

    this.setColumnReverse = function (reverseSortStatus) {
        if (this.advancedSearchOptions) {
            this.advancedSearchOptions.reverse = reverseSortStatus;
        }
    };

    this.setGridColumns = function (gridColumns) {
        if (this.advancedSearchOptions) {
            this.advancedSearchOptions.gridColumns = gridColumns;
        }
    }
})

.service('AuditHistoryDataService', function( $http, $translate, NotificationService, DHIS2URL ) {
    this.getAuditHistoryData = function(dataId, dataType ) {
        var url="";
        if (dataType === "attribute") {
            url="/audits/trackedEntityAttributeValue?tei="+dataId+"&skipPaging=true";

        } else {
            url="/audits/trackedEntityDataValue?psi="+dataId+"&skipPaging=true";
        }

        var promise = $http.get(DHIS2URL + url).then(function( response ) {
            return response.data;
        }, function( response ) {
            if( response && response.data && response.data.status === 'ERROR' ) {
                var headerText = response.data.status;
                var bodyText = response.data.message ? response.data.message : $translate.instant('unable_to_fetch_data_from_server');
                NotificationService.showNotifcationDialog(headerText, bodyText);
            }
        });
        return promise;
    }
})

/* Factory for fetching OrgUnit */
.factory('OrgUnitFactory', function($http, DHIS2URL, $q, SessionStorageService) {
    var orgUnit, orgUnitPromise, rootOrgUnitPromise,orgUnitTreePromise;
    return {
        getChildren: function(uid){
            if( orgUnit !== uid ){
                orgUnitPromise = $http.get( DHIS2URL + '/organisationUnits/'+ uid + '.json?fields=id,path,children[id,displayName,level,organisationUnitGroups[attributeValues[value,attribute[code]]],children[id]]&paging=false' ).then(function(response){
                    orgUnit = uid;
                    return response.data;
                });
            }
            return orgUnitPromise;
        },
        get: function(uid){
            if( orgUnit !== uid ){
                orgUnitPromise = $http.get( DHIS2URL + '/organisationUnits/'+ uid + '.json?fields=id,displayName,level,path,parent' ).then(function(response){
                    orgUnit = uid;
                    return response.data;
                });
            }
            return orgUnitPromise;
        },
        getViewTreeRoot: function(){
            if(!rootOrgUnitPromise){
                var url = DHIS2URL + '/me.json?fields=organisationUnits[id,displayName,level,path,children[id,displayName,level,children[id]]],dataViewOrganisationUnits[id,displayName,level,path,organisationUnitGroups[attributeValues[value,attribute[code]]],children[id,displayName,level,children[id]]]&paging=false';
                rootOrgUnitPromise = $http.get( url ).then(function(response){
                    response.data.organisationUnits = response.data.dataViewOrganisationUnits && response.data.dataViewOrganisationUnits.length > 0 ? response.data.dataViewOrganisationUnits : response.data.organisationUnits;
                    delete response.data.dataViewOrganisationUnits;
                    return response.data;
                });
            }
            return rootOrgUnitPromise;
        },
        getSearchTreeRoot: function(){
            if(!rootOrgUnitPromise){
                var url = DHIS2URL + '/me.json?fields=organisationUnits[id,displayName,level,path,children[id,displayName,level,children[id]]],teiSearchOrganisationUnits[id,displayName,level,path,children[id,displayName,level,children[id]]]&paging=false';
                rootOrgUnitPromise = $http.get( url ).then(function(response){
                    response.data.organisationUnits = response.data.teiSearchOrganisationUnits && response.data.teiSearchOrganisationUnits.length > 0 ? response.data.teiSearchOrganisationUnits : response.data.organisationUnits;
                    delete response.data.teiSearchOrganisationUnits;
                    return response.data;
                });
            }
            return rootOrgUnitPromise;
        },
        getOrgUnits: function(uid,fieldUrl){
            var url = DHIS2URL + '/organisationUnits.json?filter=id:eq:'+uid+'&'+fieldUrl+'&paging=false';
            orgUnitTreePromise = $http.get(url).then(function(response){
                return response.data;
            });
            return orgUnitTreePromise;
        },
        getOrgUnit: function(uid) {
            var def = $q.defer();
            var selectedOrgUnit = SessionStorageService.get('SELECTED_OU');
            if (selectedOrgUnit) {
                def.resolve(selectedOrgUnit);
            } else if (uid) {
                this.get(uid).then(function (response) {
                    if (response.organisationUnits && response.organisationUnits[0]) {
                        def.resolve({
                            displayName: response.organisationUnits[0].displayName,
                            id: response.organisationUnits[0].id
                        });
                    } else if (response && response.id) {
                        def.resolve(response);
                    } else {
                        def.resolve(null);
                    }
                });
            } else {
                def.resolve(null);
            }
            return def.promise;
        }
    };
});