/* Controllers */

/* global ndpFramework */


ndpFramework.controller('VisionController',
    function($scope,
        $translate,
        $modal,
        $filter,
        orderByFilter,
        SelectedMenuService,
        NotificationService,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        OptionComboService,
        FinancialDataService,
        Analytics) {

    $scope.model = {
        metaDataCached: false,
        dataElements: [],
        dataElementsById: [],
        dataElementGroups: [],
        dataSetsById: {},
        categoryCombosById: {},
        optionSets: [],
        optionSetsById: [],
        dictionaryItems: [],
        vision2040: [],
        charts: [],
        tables: [],
        maps: [],
        selectedPeriods: [],
        periods: [],
        allPeriods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly'
    };

    $scope.model.horizontalMenus = [
        {id: 'target', title: 'targets', order: 1, view: 'components/vision/results.html', active: true, class: 'main-horizontal-menu'}
    ];

    $scope.$on('MENU', function(){
        $scope.populateMenu();
    });

    $scope.$watch('model.selectedNDP', function(){
        $scope.model.selectedNdpProgram = null;
        $scope.model.ndpProgram = null;
        $scope.model.objectives = [];
        $scope.model.subPrograms = [];
        $scope.model.selectedSubProgramme = null;
        $scope.model.selectedDataElementGroupSets = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedNDP) && $scope.model.selectedNDP.id && $scope.model.selectedNDP.code){
            $scope.model.ndpProgram = $filter('getFirst')($scope.model.optionSets, {ndp: $scope.model.selectedNDP.code, isNDPProgramme: true}, true);

            $scope.getInterventions();
        }
    });

    dhis2.ndp.downloadGroupSets( 'vision2040' ).then(function(){

        OptionComboService.getBtaDimensions().then(function( response ){

            if( !response || !response.bta || !response.baseline || !response.actual || !response.target ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bta_dimensions"));
                return;
            }

            $scope.model.bta = response.bta;
            $scope.model.baseLineTargetActualDimensions = $.map($scope.model.bta.options, function(d){return d.id;});
            $scope.model.actualDimension = response.actual;
            $scope.model.targetDimension = response.target;
            $scope.model.baselineDimension = response.baseline;
                    
  
            MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                angular.forEach(ccs, function(cc){
                    $scope.model.categoryCombosById[cc.id] = cc;
                });

                MetaDataFactory.getAll('dataElements').then(function(dataElements){

                    $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                        map[obj.id] = obj;
                        return map;
                    }, {});

                    MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                        $scope.model.downloadLabel = $translate.instant('download_visualization');
                        $scope.model.metaDataCached = true;

                        $scope.model.dataElementGroups = dataElementGroups;

                        MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'vision2040').then(function(dataElementGroupSets){
                            $scope.model.dataElementGroupSets = dataElementGroupSets;
                            $scope.model.dataElementGroupSets = orderByFilter( $scope.model.dataElementGroupSets, '-displayName').reverse();

                            var periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                            $scope.model.allPeriods = angular.copy( periods );
                            $scope.model.periods = periods;

                            var selectedPeriodNames = ['2024/25'];

                            $scope.model.selectedPeriods.push( {displayName: '2009/10', id: '2009July'} );
                            angular.forEach($scope.model.periods, function(pe){
                                if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                                   $scope.model.selectedPeriods.push(pe);
                                }
                            });

                            $scope.model.selectedPeriods.push( {displayName: '2039/40', id: '2039July'} );

                            //Get orgunits for the logged in user
                            OrgUnitFactory.getViewTreeRoot().then(function(response) {
                                $scope.orgUnits = response.organisationUnits;
                                angular.forEach($scope.orgUnits, function(ou){
                                    ou.show = true;
                                    angular.forEach(ou.children, function(o){
                                        o.hasChildren = o.children && o.children.length > 0 ? true : false;
                                    });
                                });
                                $scope.selectedOrgUnit = $scope.orgUnits[0] ? $scope.orgUnits[0] : null;

                                $scope.populateMenu();

                                $scope.getAnalyticsData();

                            });
                        });
                    });
                });
            });
        });
    });

    $scope.populateMenu = function(){

        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        $scope.model.selectedGoal = null;
        $scope.model.selectedKra = null;
        $scope.model.selectedDataElementGroupSets = [];
        $scope.model.dataElementGroup = [];

        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.dataElementGroupSets );
            angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                    if ( _deg.length > 0 ){
                        $scope.model.dataElementGroup.push( _deg[0] );
                    }
                });
            });
        }
    };

    $scope.getAnalyticsData = function(){

        $scope.model.data = null;
        var analyticsUrl = '';

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( !$scope.model.dataElementGroup || $scope.model.dataElementGroup.length === 0){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vision2040_items"));
            return;
        }

        if( $scope.model.dataElementGroup && $scope.model.dataElementGroup.length > 0 && $scope.model.selectedPeriods.length > 0){
            analyticsUrl += '&filter=ou:'+ $scope.selectedOrgUnit.id +'&displayProperty=NAME&includeMetadataDetails=true';
            analyticsUrl += '&dimension=co&dimension=' + $scope.model.bta.category + ':' + $.map($scope.model.baseLineTargetActualDimensions, function(dm){return dm;}).join(';');
            analyticsUrl += '&dimension=pe:' + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(';');

            $scope.model.dataElements = [];
            var des = [];
            angular.forEach($scope.model.dataElementGroup, function(deg){
                des.push('DE_GROUP-' + deg.id);
                angular.forEach(deg.dataElements, function(de){
                    var _de = $scope.model.dataElementsById[de.id];
                    $scope.model.dataElements.push( _de );
                });
            });
            analyticsUrl += '&dimension=dx:' + des.join(';');

            FinancialDataService.getLocalData('data/cost.json').then(function(cost){
                $scope.model.cost = cost;

                Analytics.getData( analyticsUrl ).then(function(data){
                    if( data && data.data && data.metaData ){
                        $scope.model.data = data.data;
                        $scope.model.metaData = data.metaData;
                        $scope.model.reportReady = true;
                        $scope.model.reportStarted = false;
                    }
                });
            });
        }
    };

    $scope.getBaselineValue = function( dataElement, oc ){

        var filterParams = {
            dx: dataElement.id,
            pe: $scope.model.selectedPeriods[0].id,
            co: oc
        };

        var res = $filter('dataFilter')($scope.model.data, filterParams);
        return res && res[0] && res[0].value ? res[0].value : '';
    };

    $scope.getTargetValue = function( dataElement, oc ){

        var filterParams = {
            dx: dataElement.id,
            pe: $scope.model.selectedPeriods[1].id,
            co: oc
        };

        var res = $filter('dataFilter')($scope.model.data, filterParams);
        return res && res[0] && res[0].value ? res[0].value : '';
    };

    $scope.getVision2040Value = function( dataElement, oc ){

        var filterParams = {
            dx: dataElement.id,
            pe: $scope.model.selectedPeriods[2].id,
            co: oc
        };

        var res = $filter('dataFilter')($scope.model.data, filterParams);
        return res && res[0] && res[0].value ? res[0].value : '';
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = $scope.model.selectedMenu.displayName + "Vision 2040 Targets.xls";

        if( name ){
            reportName = name + '.xls';
        }
        saveAs(blob, reportName);
    };

    $scope.getIndicatorDictionary = function(item) {
        var modalInstance = $modal.open({
            templateUrl: 'components/dictionary/details-modal.html',
            controller: 'DictionaryDetailsController',
            resolve: {
                dictionaryItem: function(){
                    return item;
                }
            }
        });

        modalInstance.result.then(function () {

        });
    };

    $scope.getDataValueExplanation = function( item ){
        var modalInstance = $modal.open({
            templateUrl: 'components/explanation/explanation-modal.html',
            controller: 'DataValueExplanationController',
            windowClass: 'comment-modal-window',
            resolve: {
                item: function(){
                    return item;
                }
            }
        });

        modalInstance.result.then(function () {

        });
    };

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
        $scope.model.dataExists = false;
        $scope.model.dataHeaders = [];
    };

});
