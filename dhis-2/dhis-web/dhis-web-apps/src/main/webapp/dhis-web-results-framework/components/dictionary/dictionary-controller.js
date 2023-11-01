/* global angular, dhis2, ndpFramework */

'use strict';

//Controller for settings page
ndpFramework.controller('DictionaryController',
        function($scope,
                $modal,
                $filter,
                $translate,
                Paginator,
                NotificationService,
                SessionStorageService,
                SelectedMenuService,
                MetaDataFactory,
                DictionaryService) {

    $scope.model = {
        data: null,
        dataElements: [],
        dataElementsById: [],
        dataElementGroups: [],
        dataElementGroupSets: [],
        selectedDataElementGroups: [],
        selectedDataElementGroupSets: [],
        classificationGroupSets: [],
        classificationGroups: [],
        classificationDataElements: [],
        baseLineTargetActualDimensions: [],
        dataSetsById: {},
        categoryCombosById: {},
        optionSets: [],
        optionSetsById: [],
        dictionaryItems: [],
        attributes: [],
        selectedPeriodType: 'FinancialJuly',
        selectedDataElementGroup: null,
        selectedDictionary: null,
        dictionaryHeaders: [],
        ndp: null,
        ndpProgram: null,
        selectedNDP: null,
        selectedProgram: null,
        groupSetSize: {},
        financialPerformance: true,
        showProjectDetails: false,
        classificationGroup: null,
        completeness: {
            green: ['displayName', 'code', 'periodType', 'computationMethod', 'indicatorType', 'preferredDataSource', 'rationale', 'responsibilityForIndicator', 'unit'],
            yellow: ['displayName', 'code', 'accountabilityForIndicator', 'computationMethod', 'preferredDataSource', 'unit'],
            invalid: ['isProgrammeDocument', 'isDocumentFolder']
        }
    };

    //Paging
    $scope.pager = {pageSize: 50, page: 1, toolBarDisplay: 5};

    $scope.model.horizontalMenus = [
        {id: 'default', title: 'ndp_indicator', order: 1, view: 'components/dictionary/default.html', active: true, class: 'main-horizontal-menu'},
        {id: 'classification', title: 'indicator_classification', order: 2, view: 'components/dictionary/classification.html', class: 'main-horizontal-menu'}
    ];

    $scope.$on('MENU', function(){
        $scope.populateMenu();
    });

    $scope.populateMenu = function(){
        $scope.resetView();
        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
    };

    $scope.getDataElementGroupSetsForNdp = function(){
        $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.dataElementGroupSets );
        if( angular.isObject($scope.model.selectedNDP) && $scope.model.selectedNDP.code){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedNDP.code}, true);
            $scope.model.ndpProgram = $filter('filter')($scope.model.optionSets, {ndp: $scope.model.selectedNDP.code, isNDPProgramme: true}, true)[0];
        }

        $scope.model.selectedDataElementGroups = [];

        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            angular.forEach(degs.dataElementGroups, function(deg){
                $scope.model.selectedDataElementGroups.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
            });
        });
    };

    $scope.getSelectedDataElementGroups = function(){
        $scope.model.dataElements = [];
        var available = [];
        angular.forEach($scope.model.selectedDataElementGroups, function(deg){
            angular.forEach(deg.dataElements, function(de){
                var _de = $scope.model.dataElementsById[de.id];
                if( _de && available.indexOf(de.id) === -1 ){
                    $scope.model.dataElements.push( _de );
                    available.push( de.id );
                }
            });
        });
    };

    $scope.$watch('model.selectedProgram', function(){
        $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.dataElementGroupSets );
        $scope.model.selectedDataElementGroups = angular.copy( $scope.model.dataElementGroups );
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.code){
            $scope.model.selectedDataElementGroups = [];
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedNDP.code, ndpProgramme: $scope.model.selectedProgram.code}, true);

            angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    $scope.model.selectedDataElementGroups.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
                });
            });
        }

        $scope.getSelectedDataElementGroups();
    });

    $scope.$watch('model.selectedClassification', function(){

        $scope.model.classificationGroups = angular.copy( $scope.model.dataElementGroups );

        if ( angular.isObject( $scope.model.selectedClassification ) && $scope.model.selectedClassification.id ){
            $scope.model.classificationGroups = [];
            var _deg = $filter('filter')($scope.model.dataElementGroups, {id: $scope.model.selectedClassification.id});
            if (_deg && _deg.length > 0){
                $scope.model.classificationGroups.push( _deg[0] );
            }
        }
        else{
            $scope.model.classificationGroups = [];
            $scope.model.classificationGroupSets = angular.copy( [$scope.model.classificationGroup] );
            if ( $scope.model.classificationGroup && $scope.model.classificationGroup.dataElementGroups ){
                angular.forEach($scope.model.classificationGroup.dataElementGroups, function(deg){
                    var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                    if (_deg && _deg.length > 0){
                        $scope.model.classificationGroups.push( _deg[0] );
                    }
                });
            }
        }
        //$scope.getClassificationGroups();
    });
    
    $scope.fetchIndicators = function(){
        $scope.model.reportReady = false;
        $scope.model.reportStarted = true;
        $scope.model.dataElements = [];
        $scope.model.totalDataElements = 0;
        DictionaryService.getDataElements( $scope.pager, $scope.model.dictionaryHeaders, $scope.model.completeness, $scope.model.categoryCombosById, $scope.model.filterText, $scope.sortHeader ).then(function( response ){
            if ( response && response.dataElements ){
                $scope.model.dataElementsById = response.dataElementsById;
                $scope.model.dataElements = response.dataElements;
                $scope.model.totalDataElements = response.totalDataElements;
            }
            if ( response.pager ){
                response.pager.pageSize = response.pager.pageSize ? response.pager.pageSize : $scope.pager.pageSize;
                $scope.pager = response.pager;
                $scope.pager.toolBarDisplay = 5;

                Paginator.setPage($scope.pager.page);
                Paginator.setPageCount($scope.pager.pageCount);
                Paginator.setPageSize($scope.pager.pageSize);
                Paginator.setItemCount($scope.pager.total);                
                $scope.model.totalDataElements = $scope.pager.total;
            }
            $scope.model.reportReady = true;
            $scope.model.reportStarted = false;
        });
    };

    dhis2.ndp.downloadMetaData().then(function(){
        SessionStorageService.set('METADATA_CACHED', true);
        
        MetaDataFactory.getAll('attributes').then(function(attributes){

            $scope.model.attributes = attributes;

            MetaDataFactory.getAll('categoryCombos').then(function(categoryCombos){
                angular.forEach(categoryCombos, function(cc){
                    $scope.model.categoryCombosById[cc.id] = cc;
                });

                MetaDataFactory.getAll('optionSets').then(function(optionSets){
                    $scope.model.optionSets = optionSets;
                    angular.forEach(optionSets, function(optionSet){
                        $scope.model.optionSetsById[optionSet.id] = optionSet;
                    });

                    $scope.model.ndp = $filter('getFirst')($scope.model.optionSets, {code: 'ndp'});

                    if( !$scope.model.ndp || !$scope.model.ndp.code ){
                        NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_ndp_configuration"));
                        return;
                    }

                    $scope.model.ndpProgram = $filter('filter')(optionSets, {code: 'ndpIIIProgram'})[0];
                    
                    $scope.sortHeader = {id: 'displayName', name: 'name', colSize: "col-sm-1", show: true, fetch: false, direction: 'asc'};
                    $scope.model.dictionaryHeaders = [
                        {id: 'displayName', name: 'name', colSize: "col-sm-1", show: true, fetch: false, sortable: true, direction: 'asc'},
                        {id: 'code', name: 'code', colSize: "col-sm-1", show: true, fetch: false, sortable: true},
                        {id: 'aggregationType', name: 'aggregationType', colSize: "col-sm-1", show: true, fetch: false, direction: 'asc'},
                        {id: 'disaggregation', name: 'disaggregation', colSize: "col-sm-1", show: true, fetch: false},
                        {id: 'valueType', name: 'valueType', colSize: "col-sm-1", show: true, fetch: false},
                        {id: 'periodType', name: 'frequency', colSize: "col-sm-1", show: true, fetch: false},
                        {id: 'vote', name: 'vote', colSize: 'col-sm-1', show: true, fetch: false}
                    ];

                    angular.forEach($scope.model.attributes, function(att){
                        if(att['dataElementAttribute'] && $scope.model.completeness.invalid.indexOf(att.code) === -1 ){
                            var header = {id: att.code, name: att.name, show: false, fetch: true, colSize: "col-sm-1"};
                            $scope.model.dictionaryHeaders.push(header);
                        }
                    });

                    $scope.populateMenu();
                    $scope.fetchIndicators();
                });
            });
        });
    });

    $scope.jumpToPage = function(){
        if($scope.pager && $scope.pager.page && $scope.pager.pageCount && $scope.pager.page > $scope.pager.pageCount){
            $scope.pager.page = $scope.pager.pageCount;
        }
        $scope.fetchIndicators();
    };

    $scope.resetPageSize = function(){
        $scope.pager.page = 1;
        $scope.fetchIndicators();
    };

    $scope.getPage = function(page){
        $scope.pager.page = page;
        $scope.fetchIndicators();
    };

    $scope.sortItems = function(header){
        if ( $scope.sortHeader && $scope.sortHeader.id === header.id ){
            if ( $scope.sortHeader.direction  === 'desc' ){
                $scope.sortHeader.direction = 'asc';
            }
            else{
                $scope.sortHeader.direction = 'desc';
            }
        }
        else{
            $scope.sortHeader = header;
            $scope.sortHeader.direction = 'asc';
        }
        $scope.fetchIndicators();
    };

    $scope.filterIndicators = function(){
        $scope.fetchIndicators();
    };

    $scope.showDetails = function( item ){
        var modalInstance = $modal.open({
            templateUrl: 'components/dictionary/details-modal.html',
            controller: 'DictionaryDetailsController',
            resolve: {
                dictionaryItem: function(){
                    return item;
                },
                fullFetched: function(){
                    return true;
                }
            }
        });

        modalInstance.result.then(function () {
        });
    };

    $scope.showHideColumns = function(){
        var modalInstance = $modal.open({
            templateUrl: 'views/column-modal.html',
            controller: 'ColumnDisplayController',
            resolve: {
                gridColumns: function () {
                    return $scope.model.dictionaryHeaders;
                },
                hiddenGridColumns: function(){
                    return ($filter('filter')($scope.model.dictionaryHeaders, {show: false})).length;
                }
            }
        });

        modalInstance.result.then(function (gridColumns) {
            $scope.model.dictionaryHeaders = gridColumns;
        });
    };

    $scope.itemExists = function( item ){
        return $scope.model.selectedDataElementGroups.indexOf( item ) !== -1;
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = "indicator-dictionary.xls";
        if( name ){
            reportName = name + '.xls';
        }
        saveAs(blob, reportName);
    };

    $scope.resetView = function( horizontalMenu ){
        $scope.model.selectedProgram = null;
        $scope.model.filterText = null;
    };
});
