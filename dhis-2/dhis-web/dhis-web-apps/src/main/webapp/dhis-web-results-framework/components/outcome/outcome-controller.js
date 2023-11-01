/* Controllers */

/* global ndpFramework */

ndpFramework.controller('OutcomeController',
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
        CommonUtils,
        DataValueService,
        FinancialDataService,
        ClusterDataService,
        DateUtils) {

    $scope.model = {
        metaDataCached: false,
        data: null,
        reportReady: false,
        dataExists: false,
        dataHeaders: [],
        dataElementsById: [],
        optionSetsById: [],
        optionSets: [],
        legendSetsById: [],
        defaultLegendSet: null,
        ndpProgrammes: [],
        dataElementGroup: [],
        selectedDataElementGroupSets: [],
        performanceOverviewHeaders: [],
        dataElementGroups: [],
        selectedNdpProgram: null,
        selectedPeriods: [],
        periods: [],
        allPeriods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly',
        displayProjectOutputs: true,
        displayDepartmentOutPuts: true,
        explanations: [],
        commentRow: {},
        clusters: []
    };

    $scope.model.horizontalMenus = [
        {id: 'target', title: 'targets', order: 1, view: 'components/outcome/results.html', active: true, class: 'main-horizontal-menu'},
        {id: 'physicalPerformance', title: 'performance', order: 2, view: 'components/outcome/physical-performance.html', class: 'main-horizontal-menu'},
        {id: 'performanceOverview', title: 'performance_overview', order: 3, view: 'components/outcome/performance-overview.html', class: 'main-horizontal-menu'},
        {id: 'clusterPerformance', title: 'cluster_performance', order: 4, view: 'views/cluster/cluster-performance.html', class: 'main-horizontal-menu'},
        {id: 'completeness', title: 'completeness', order: 5, view: 'components/outcome/completeness.html', class: 'main-horizontal-menu'}
    ];

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

    $scope.getOutcomes = function(){
        $scope.model.dataElementGroup = [];
        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            angular.forEach(degs.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {indicatorGroupType: 'outcome', id: deg.id}, true);
                if ( _deg.length > 0 ){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });
        });
    };

    $scope.$on('MENU', function(){
        //$scope.populateMenu();
    });

    $scope.$watch('model.selectedNdpProgram', function(){
        $scope.resetDataView();
        $scope.model.objectives = [];
        $scope.model.selectedDataElementGroupSets = [];
        if( angular.isObject($scope.model.selectedNdpProgram) ){
            if( $scope.model.selectedNdpProgram && $scope.model.selectedNdpProgram.code ){
                var filter = {ndpProgramme: $scope.model.selectedNdpProgram.code};
                $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, filter, true);
                $scope.getOutcomes();
            }
        }
    });

    $scope.$watch('model.selectedCluster', function(){
        $scope.resetDataView();
    });

    $scope.getBasePeriod = function(){
        $scope.model.basePeriod = null;
        var location = -1;

        var getBase = function(){
            $scope.model.selectedPeriods = orderByFilter( $scope.model.selectedPeriods, '-id').reverse();
            var p = $scope.model.selectedPeriods[0];
            var res = PeriodService.getPreviousPeriod( p.id, $scope.model.allPeriods );
            $scope.model.basePeriod = res.period;
            location = res.location;
        };

        getBase();

        if( location === 0 ){
            $scope.getPeriods('PREV');
            getBase();
        }
    };

    dhis2.ndp.downloadGroupSets( 'objective' ).then(function(){

        MetaDataFactory.getAll('legendSets').then(function(legendSets){

            /*angular.forEach(legendSets, function(legendSet){
                if ( legendSet.isTrafficLight ){
                    $scope.model.defaultLegendSet = legendSet;
                }
                $scope.model.legendSetsById[legendSet.id] = legendSet;
            });*/

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
 
                    MetaDataFactory.getAll('dataElements').then(function(dataElements){

                        $scope.model.allDataElements = dataElements;

                        $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                            map[obj.id] = obj;
                            return map;
                        }, {});

                        MetaDataFactory.getAll('optionGroupSets').then(function(optionGroupSets){
                            
                            $scope.model.optionGroupSets = optionGroupSets;

                            MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                                $scope.model.allDataElementGroups = dataElementGroups;
                                $scope.model.dataElementGroups = dataElementGroups;

                                MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'objective').then(function(dataElementGroupSets){
                                    $scope.model.dataElementGroupSets = dataElementGroupSets;
                                    $scope.model.dataElementGroupSets = orderByFilter( $scope.model.dataElementGroupSets, ['-code', '-displayName']).reverse();

                                    var periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                    $scope.model.allPeriods = angular.copy( periods );
                                    $scope.model.periods = periods;
                                    
                                    var selectedPeriodNames = ['2020/21', '2021/22', '2022/23', '2023/24', '2024/25'];
                                    var today = DateUtils.getToday();
                                    angular.forEach($scope.model.periods, function(pe){
                                        if ( pe.startDate <= today && pe.endDate >= today ){
                                            $scope.model.selectedFiscalYear = pe;
                                        }
                                        if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                                            $scope.model.selectedPeriods.push(pe);
                                        }
                                    });

                                    $scope.model.metaDataCached = true;
                                    $scope.populateMenu();
                                    $scope.model.performanceOverviewLegends = CommonUtils.getPerformanceOverviewHeaders();
                                });
                            });                            
                        });
                    });
                });
            });
        });
    });

    $scope.populateMenu = function(){

        $scope.resetDataView();
        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        $scope.model.selectedNdpProgram = null;

        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
            var prs = $filter('filter')($scope.model.optionSets, {ndp: $scope.model.selectedMenu.ndp, isNDPProgramme: true}, true);
            if ( !prs || prs.length !== 1 ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_program_config") + ' - ' + $scope.model.selectedMenu.ndp );
                return;
            }
            else{
                $scope.model.ndpProgram = prs[0];
            }

            var sectorsOpgs = $filter('getFirst')($scope.model.optionGroupSets, {code: $scope.model.selectedMenu.ndp + '_CLUSTER'});
            
            $scope.model.clusters = sectorsOpgs && sectorsOpgs.optionGroups ? sectorsOpgs.optionGroups : [];
            if( !$scope.model.clusters || !$scope.model.clusters.length || !$scope.model.clusters.length === 0 ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_cluster_configuration"));
                return;
            }
        }
    };

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.clusterData = null;
        $scope.model.reportReady = false;
        $scope.model.clusterReportReady = false;
        $scope.model.dataExists = false;
        $scope.model.dataHeaders = [];
    };

    $scope.getPeriods = function(mode){
        var periods = [];
        if( mode === 'NXT'){
            $scope.model.periodOffset = $scope.model.periodOffset + 1;
            periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }
        else{
            $scope.model.periodOffset = $scope.model.periodOffset - 1;
            periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }

        var periodsById = {};
        angular.forEach($scope.model.periods, function(p){
            periodsById[p.id] = p;
        });

        angular.forEach(periods, function(p){
            if( !periodsById[p.id] ){
                periodsById[p.id] = p;
            }
        });

        $scope.model.periods = Object.values( periodsById );

        $scope.model.allPeriods = angular.copy( $scope.model.periods );
    };

    $scope.getAnalyticsData = function(){

        $scope.model.data = null;
        var analyticsUrl = '';

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( $scope.model.dataElementGroup.length === 0 || !$scope.model.dataElementGroup ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_outcome"));
            return;
        }

        $scope.getBasePeriod();

        if ( !$scope.model.basePeriod || !$scope.model.basePeriod.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_base_period"));
            return;
        }

        if( $scope.model.dataElementGroup && $scope.model.dataElementGroup.length > 0 && $scope.model.selectedPeriods.length > 0){
            analyticsUrl += '&filter=ou:'+ $scope.selectedOrgUnit.id +'&displayProperty=NAME&includeMetadataDetails=true';
            analyticsUrl += '&dimension=co&dimension=' + $scope.model.bta.category + ':' + $.map($scope.model.baseLineTargetActualDimensions, function(dm){return dm;}).join(';');
            analyticsUrl += '&dimension=pe:' + $.map($scope.model.selectedPeriods.concat( $scope.model.basePeriod ), function(pe){return pe.id;}).join(';');

            var pHeaders = CommonUtils.getPerformanceOverviewHeaders();
            $scope.model.pHeadersLength = pHeaders.length;
            var prds = orderByFilter( $scope.model.selectedPeriods, '-id').reverse();
            $scope.model.performanceOverviewHeaders = [];
            angular.forEach(prds, function(pe){
                angular.forEach( pHeaders, function(p){
                    var h = angular.copy( p );
                    h.period = pe.id;
                    $scope.model.performanceOverviewHeaders.push( h );
                });
            });

            $scope.model.dataElementGroupsById = $scope.model.dataElementGroup.reduce( function(map, obj){
                map[obj.id] = obj;
                return map;
            }, {});

            var des = [];
            angular.forEach($scope.model.dataElementGroup, function(deg){
                des.push('DE_GROUP-' + deg.id);
            });
            analyticsUrl += '&dimension=dx:' + des.join(';');

            $scope.model.reportReady = false;
            $scope.model.reportStarted = true;
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
                            actualDimension: $scope.model.actualDimension,
                            targetDimension: $scope.model.targetDimension,
                            baselineDimension: $scope.model.baselineDimension,
                            selectedDataElementGroupSets: $scope.model.selectedDataElementGroupSets,
                            selectedDataElementGroup: $scope.model.selectedKra,
                            dataElementGroups: $scope.model.dataElementGroups,
                            basePeriod: $scope.model.basePeriod,
                            maxPeriod: $scope.model.selectedPeriods.slice(-1)[0],
                            allPeriods: $scope.model.allPeriods,
                            dataElementGroupsById: $scope.model.dataElementGroupsById,
                            dataElementsById: $scope.model.dataElementsById,
                            cost: $scope.model.cost,
                            legendSetsById: $scope.model.legendSetsById,
                            defaultLegendSet: $scope.model.defaultLegendSet,
                            performanceOverviewHeaders: $scope.model.performanceOverviewHeaders,
                            displayActionBudgetData: false
                        };

                        var processedData = Analytics.processData( dataParams );
                        $scope.model.dataHeaders = processedData.dataHeaders;
                        $scope.model.reportPeriods = processedData.reportPeriods;
                        $scope.model.dataExists = processedData.dataExists;
                        $scope.model.selectedDataElementGroupSets = processedData.selectedDataElementGroupSets;
                        $scope.model.hasPhysicalPerformanceData = processedData.hasPhysicalPerformanceData;
                        $scope.model.numerator = processedData.completenessNum;
                        $scope.model.denominator = processedData.completenessDen;
                        $scope.model.dataElementRowIndex = processedData.dataElementRowIndex;
                        $scope.model.tableRows = processedData.tableRows;
                        $scope.model.povTableRows = processedData.povTableRows;
                    }
                });
            });
        }
    };
    
    $scope.getClusterData = function(){
        
        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( !$scope.model.selectedCluster || !$scope.model.selectedCluster.options || !$scope.model.selectedCluster.options.length ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_cluster"));
            return;
        }

        if( !$scope.model.selectedFiscalYear ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_fiscal_year"));
            return;
        }

        var params = {
            indicatorGroupType: 'outcome',
            selectedOrgUnit: $scope.selectedOrgUnit,
            selectedCluster: $scope.model.selectedCluster,
            selectedFiscalYear: $scope.model.selectedFiscalYear,            
            allDataElementGroups: $scope.model.allDataElementGroups,
            dataElementGroupSets: $scope.model.dataElementGroupSets,
            bta: $scope.model.bta,
            baseLineTargetActualDimensions: $scope.model.baseLineTargetActualDimensions,
            actualDimension: $scope.model.actualDimension,
            targetDimension: $scope.model.targetDimension,
            baselineDimension: $scope.model.baselineDimension,
            selectedDataElementGroupSets: $scope.model.clusterDataElementGroupSets,
            selectedDataElementGroup: $scope.model.selectedKra,
            dataElementsById: $scope.model.dataElementsById,
            legendSetsById: $scope.model.legendSetsById,
            defaultLegendSet: $scope.model.defaultLegendSet
        };

        $scope.model.clusterReportReady = false;
        $scope.model.clusterReportStarted = true;
        ClusterDataService.getData( params ).then(function(result){
            $scope.model.clusterReportReady = true;
            $scope.model.clusterReportStarted = false;
            $scope.model.clusterData = result.clusterData;
            $scope.model.hasClusterData = result.hasClusterData;
            $scope.model.clusterPerformanceOverviewHeaders = result.clusterPerformanceOverviewHeaders;
        });        
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
        var blob = new Blob([document.getElementById(name).innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = $scope.model.selectedNdpProgram.displayName + " - objectives";

        if ( name ) {
            reportName += " - " + name;
        }

        reportName += ".xls";

        saveAs(blob, reportName);
    };

    $scope.getIndicatorDictionary = function(item) {
        var modalInstance = $modal.open({
            templateUrl: 'components/dictionary/details-modal.html',
            controller: 'DictionaryDetailsController',
            resolve: {
                dictionaryItem: function(){
                    return item;
                },
                fullFetched: function(){
                    return false;
                }
            }
        });

        modalInstance.result.then(function () {

        });
    };

    $scope.getExplanations = function(){
        $scope.model.showExplanation = !$scope.model.showExplanation;
        if ( $scope.model.showExplanation && $scope.model.explanations.length === 0 ){
            var dataValueSetUrl = 'orgUnit=' + $scope.selectedOrgUnit.id;
            dataValueSetUrl += '&children=true';
            dataValueSetUrl += '&startDate=' + $scope.model.selectedPeriods[0].startDate;
            dataValueSetUrl += '&endDate='  + $scope.model.selectedPeriods.slice(-1)[0].endDate;

            angular.forEach($scope.model.dataElementGroup, function(deg){
                dataValueSetUrl += '&dataElementGroup=' + deg.id;
            });

            DataValueService.getDataValueSet( dataValueSetUrl ).then(function( response ){
                if ( response && response.dataValues){
                    angular.forEach(response.dataValues, function(dv){
                        if(dv.comment){
                            dv.comment = JSON.parse( dv.comment );
                            if ( dv.comment.explanation ){
                                $scope.model.explanations.push({
                                    dataElement: dv.dataElement,
                                    order: $scope.model.dataElementRowIndex[dv.dataElement],
                                    comment: dv.comment.explanation
                                });
                            }
                        }
                    });

                    $scope.model.explanations = orderByFilter( $scope.model.explanations, '-order').reverse();
                    var index = 1;
                    angular.forEach($scope.model.explanations, function(exp){
                        $scope.model.commentRow[exp.dataElement] = index;
                        index++;
                    });
                }
            });
        }
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

    $scope.getCoverage = function(numerator, denominator){
        return CommonUtils.getPercent(numerator, denominator, false, true);
    };

    $scope.getHeaderClass = function(header){
        return header.style;
    };
});