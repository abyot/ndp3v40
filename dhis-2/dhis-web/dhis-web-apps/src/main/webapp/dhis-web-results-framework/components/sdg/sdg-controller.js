/* Controllers */

/* global ndpFramework */


ndpFramework.controller('SDGController',
    function($scope,
        $translate,
        $modal,
        $filter,
        orderByFilter,
        NotificationService,
        SelectedMenuService,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        OptionComboService,
        Analytics,
        DashboardService,
        FinancialDataService) {

    $scope.showReportFilters = false;

    $scope.model = {
        metaDataCached: false,
        data: null,
        dataElements: [],
        dataElementsById: [],
        kra: [],
        goals: [],
        objectives: [],
        selectedKra: null,
        selectedSdg: null,
        selectedDataElementGroupSets: [],
        dataElementGroups: [],
        baseLineTargetActualDimensions: [],
        dataSetsById: {},
        categoryCombosById: {},
        optionSets: [],
        optionSetsById: [],
        dictionaryItems: [],
        selectedPeriods: [],
        periods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly',
        groupSetSize: {},
        physicalPerformance: true,
        financialPerformance: true,
        showProjectDetails: false
    };

    $scope.model.horizontalMenus = [
        {id: 'physicalPerformance', title: 'physical_performance', order: 1, view: 'components/sdg/physical-performance.html', active: true, class: 'main-horizontal-menu'},
        {id: 'budgetPerformance', title: 'budget_performance', order: 2, view: 'components/sdg/budget-performance.html', class: 'main-horizontal-menu'},
        {id: 'dashboard', title: 'dashboard', order: 6, view: 'views/dashboard.html', class: 'main-horizontal-menu'}
    ];

    $scope.$watch('model.selectedSdgGoal', function(){
        $scope.model.selectedTarget = null;
        $scope.model.targets = [];
        $scope.model.dataElementGroup = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedSdgGoal) && $scope.model.selectedSdgGoal.id){
            angular.forEach($scope.model.selectedSdgGoal.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                if ( _deg.length > 0 ){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });

            $scope.model.targets = $scope.model.selectedSdgGoal.dataElementGroups;
        }
        else{
            angular.forEach($scope.model.dataElementGroupSets, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                    if ( _deg.length > 0 ){
                        $scope.model.dataElementGroup.push( _deg[0] );
                    }
                });
            });
        }
    });

    $scope.$watch('model.selectedTarget', function(){
        $scope.model.selectedIndicator = null;
        $scope.model.selectedDataElementGroupSets = [];
        $scope.model.dataElementGroup = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedTarget) && $scope.model.selectedTarget.id){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {id: $scope.model.selectedTarget.id});
            $scope.getTargets();
        }
        else{
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.targets );
            $scope.getTargets();
        }
    });

    $scope.getTargets = function(){
        $scope.model.dataElementGroup = [];
        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            angular.forEach(degs.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                if (_deg && _deg.length > 0){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });
        });
    };

    dhis2.ndp.downloadGroupSets( 'sdg' ).then(function(){

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

            OptionComboService.getBtaDimensions().then(function( bta ){

                if( !bta || !bta.category || !bta.options || bta.options.length !== 3 ){
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bta_dimensions"));
                    return;
                }

                $scope.model.bta = bta;
                $scope.model.baseLineTargetActualDimensions = $.map($scope.model.bta.options, function(d){return d.id;});

                MetaDataFactory.getAll('dataElements').then(function(dataElements){

                    $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                        map[obj.id] = obj;
                        return map;
                    }, {});

                    MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                        $scope.model.dataElementGroups = dataElementGroups;

                        MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'sdg').then(function(dataElementGroupSets){
                            $scope.model.dataElementGroupSets = dataElementGroupSets;
                            $scope.model.dataElementGroupSets = orderByFilter( $scope.model.dataElementGroupSets, '-code').reverse();

                            var periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                            $scope.model.allPeriods = angular.copy( periods );
                            $scope.model.periods = periods;

                            var selectedPeriodNames = ['2020/21', '2021/22', '2022/23', '2023/24', '2024/25'];

                            angular.forEach($scope.model.periods, function(pe){
                                if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                                   $scope.model.selectedPeriods.push(pe);
                                }
                            });

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
                            });

                            $scope.model.metaDataCached = true;
                            $scope.populateMenu();

                            /*$scope.model.dashboardName = 'SDGs';
                            DashboardService.getByName( $scope.model.dashboardName ).then(function( result ){
                                $scope.model.dashboardItems = result.dashboardItems;
                                $scope.model.charts = result.charts;
                                $scope.model.tables = result.tables;
                                $scope.model.maps = result.maps;
                                $scope.model.dashboardFetched = true;

                                $scope.populateMenu();
                            });*/
                        });
                    });
                });
            });
        });

    });

    $scope.populateMenu = function(){

        $scope.resetDataView();
        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        $scope.model.selectedSdg = null;
        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
            $scope.model.sdgGoals = angular.copy( $scope.model.dataElementGroupSets );
            if( $scope.model.sdgGoals && $scope.model.sdgGoals.length === 1 ){
                $scope.model.selectedSdg = $scope.model.sdgGoals[0];
            }
        }
    };

    $scope.getPeriods = function(mode){
        if( mode === 'NXT'){
            $scope.model.periodOffset = $scope.model.periodOffset + 1;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }
        else{
            $scope.model.periodOffset = $scope.model.periodOffset - 1;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }
    };

    $scope.getAnalyticsData = function(){

        $scope.model.data = null;
        var analyticsUrl = '';

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( $scope.model.dataElementGroup.length === 0 || !$scope.model.dataElementGroup ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_target_or_proxy"));
            return;
        }

        if( $scope.model.dataElementGroup && $scope.model.dataElementGroup.length > 0 && $scope.model.selectedPeriods.length > 0){
            analyticsUrl += '&filter=ou:'+ $scope.selectedOrgUnit.id +'&displayProperty=NAME&includeMetadataDetails=true';
            analyticsUrl += '&dimension=co&dimension=' + $scope.model.bta.category + ':' + $.map($scope.model.baseLineTargetActualDimensions, function(dm){return dm;}).join(';');
            analyticsUrl += '&dimension=pe:' + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(';');

            var des = [];
            angular.forEach($scope.model.dataElementGroup, function(deg){
                des.push('DE_GROUP-' + deg.id);
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

                        var dataParams = {
                            data: data.data,
                            metaData: data.metaData,
                            reportPeriods: angular.copy( $scope.model.selectedPeriods ),
                            bta: $scope.model.bta,
                            selectedDataElementGroupSets: $scope.model.dataElementGroupSets,
                            selectedDataElementGroup: $scope.model.selectedKra,
                            dataElementGroups: $scope.model.dataElementGroups,
                            basePeriod: $scope.model.basePeriod,
                            maxPeriod: $scope.model.selectedPeriods.slice(-1)[0],
                            allPeriods: $scope.model.allPeriods,
                            dataElementsById: $scope.model.dataElementsById,
                            cost: $scope.model.cost
                        };

                        var processedData = Analytics.processData( dataParams );

                        $scope.model.dataHeaders = processedData.dataHeaders;
                        $scope.model.reportPeriods = processedData.reportPeriods;
                        $scope.model.dataExists = processedData.dataExists;
                        $scope.model.resultData = processedData.resultData || [];
                        $scope.model.performanceData = processedData.performanceData || [];
                        $scope.model.cumulativeData = processedData.cumulativeData || [];
                        $scope.model.costData = processedData.costData || [];
                        $scope.model.costEffData = processedData.costEffData || [];
                        $scope.model.sdgView = true;
                    }
                });
            });
        }
    };

    $scope.showOrgUnitTree = function(){
        var modalInstance = $modal.open({
            templateUrl: 'components/outree/orgunit-tree.html',
            controller: 'OuTreeController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                },
                validOrgUnits: function(){
                    return null;
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                $scope.selectedOrgUnit = selectedOu;
                $scope.resetDataView();
            }
        });
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = $scope.model.selectedSdg.ndp + " objective" + " .xls";
        if( name ){
            reportName = name + ' performance.xls';
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

    $scope.getRFInformation = function( item ){
        NotificationService.showNotifcationDialog($translate.instant("info"), $translate.instant("Need to display NDP program source here ..."));
    };

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
        $scope.model.dataExists = false;
        $scope.model.dataHeaders = [];
    };
});
