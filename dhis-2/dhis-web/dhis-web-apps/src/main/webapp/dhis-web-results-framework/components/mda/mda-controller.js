/* Controllers */

/* global ndpFramework, dhis2 */


ndpFramework.controller('MDAController',
        function($scope,
        $translate,
        $modal,
        $filter,
        NotificationService,
        SelectedMenuService,
        orderByFilter,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        Analytics,
        ResulstChainService,
        OptionComboService,
        OrgUnitGroupSetService) {

    $scope.model = {
        metaDataCached: false,
        data: null,
        reportReady: false,
        dataExists: false,
        dataHeaders: [],
        optionSetsById: [],
        optionSets: [],
        legendSetsById: [],
        defaultLegendSet: null,
        sectors: [],
        selectedVote: null,
        selectedSector: null,
        interventions: [],
        objectives: [],
        dataElementGroup: [],
        selectedDataElementGroupSets: [],
        dataElementGroups: [],
        selectedNdpProgram: null,
        selectedPeriods: [],
        periods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly'
    };

    $scope.model.horizontalMenus = [
        {id: 'physicalPerformance', title: 'physical_performance', order: 1, view: 'components/mda/physical-performance.html', active: true, class: 'main-horizontal-menu'},
        {id: 'budgetPerformance', title: 'budget_performance', order: 2, view: 'components/mda/budget-performance.html', class: 'main-horizontal-menu'},
        {id: 'dashboard', title: 'dashboard', order: 4, view: 'components/mda/dashboard.html', class: 'main-horizontal-menu'}
    ];

    $scope.$watch('selectedOrgUnit', function(){
        $scope.resetDataView();
        if( angular.isObject($scope.selectedOrgUnit) && $scope.selectedOrgUnit.id){
            OrgUnitGroupSetService.getByVote( $scope.selectedOrgUnit.id ).then(function(data){
                $scope.model.selectedVote = data;
                $scope.getInterventions();
            });
        }
    });

    $scope.$watch('model.selectedNdpProgram', function(){
        $scope.resetDataView();

        if( $scope.model.piapResultsChain && $scope.model.piapResultsChain.code ){
            $scope.model.subProgrammes = $scope.model.resultsFrameworkChain.subPrograms;
            $scope.model.piapObjectives = $scope.model.resultsFrameworkChain.objectives;
            $scope.model.interventions = $scope.model.resultsFrameworkChain.interventions;
        }

        $scope.model.selectedSubProgramme = null;
        $scope.model.selectedObjective = null;
        $scope.model.selectedIntervention = null;
        if( angular.isObject($scope.model.selectedNdpProgram) ){
            if( $scope.model.selectedNdpProgram && $scope.model.selectedNdpProgram.code ){
                $scope.model.subProgrammes = $filter('startsWith')($scope.model.subProgrammes, {code: $scope.model.selectedNdpProgram.code});
                $scope.model.piapObjectives = $filter('startsWith')($scope.model.piapObjectives, {code: $scope.model.selectedNdpProgram.code});
                $scope.model.interventions = $filter('startsWith')($scope.model.interventions, {code: $scope.model.selectedNdpProgram.code});
            }
        }
    });

    $scope.$watch('model.selectedSubProgramme', function(){
        $scope.resetDataView();

        if( $scope.model.piapResultsChain && $scope.model.piapResultsChain.code ){
            $scope.model.piapObjectives = $scope.model.resultsFrameworkChain.objectives;
            $scope.model.interventions = $scope.model.resultsFrameworkChain.interventions;
        }

        $scope.model.selectedObjective = null;
        $scope.model.selectedIntervention = null;
        if( angular.isObject($scope.model.selectedSubProgramme) ){
            if( $scope.model.selectedSubProgramme && $scope.model.selectedSubProgramme.code ){
                $scope.model.piapObjectives = $filter('startsWith')($scope.model.piapObjectives, {code: $scope.model.selectedSubProgramme.code});
                $scope.model.interventions = $filter('startsWith')($scope.model.interventions, {code: $scope.model.selectedSubProgramme.code});
            }
        }
    });

    $scope.$watch('model.selectedObjective', function(){
        $scope.resetDataView();

        if( $scope.model.piapResultsChain && $scope.model.piapResultsChain.code ){
            $scope.model.interventions = $scope.model.resultsFrameworkChain.interventions;
        }

        $scope.model.selectedIntervention = null;
        if( angular.isObject($scope.model.selectedObjective) ){
            if( $scope.model.selectedObjective && $scope.model.selectedObjective.code ){
                $scope.model.interventions = $filter('startsWith')($scope.model.interventions, {code: $scope.model.selectedObjective.code});
            }
        }
    });

    dhis2.ndp.downloadGroupSets( 'sub-intervention' ).then(function(){

        //Get orgunits for the logged in user
        OrgUnitFactory.getViewTreeRoot().then(function(response) {
            $scope.orgUnits = response.organisationUnits;
            angular.forEach($scope.orgUnits, function(ou){
                ou.show = true;
                angular.forEach(ou.children, function(o){
                    o.hasChildren = o.children && o.children.length > 0 ? true : false;
                });
            });
            $scope.selectedOrgUnit = null;

            OrgUnitGroupSetService.getByGroup('mda').then(function(mdas){
                $scope.model.mdas = mdas;

                MetaDataFactory.getAll('legendSets').then(function(legendSets){

                    angular.forEach(legendSets, function(legendSet){
                        if ( legendSet.isTrafficLight ){
                            $scope.model.defaultLegendSet = legendSet;
                        }
                        $scope.model.legendSetsById[legendSet.id] = legendSet;
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

                        $scope.model.piapResultsChain = $filter('getFirst')($scope.model.optionSets, {code: 'piapResultsChain'});
                        if( !$scope.model.piapResultsChain || !$scope.model.piapResultsChain.code || !$scope.model.piapResultsChain.options || $scope.model.piapResultsChain.options.length < 1 ){
                            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_piap_results_chain_configuration"));
                            return;
                        }

                        ResulstChainService.getByOptionSet( $scope.model.piapResultsChain.id ).then(function(chain){
                            $scope.model.resultsFrameworkChain = chain;
                            $scope.model.ndpProgrammes = $scope.model.resultsFrameworkChain.programs;
                            $scope.model.subProgrammes = $scope.model.resultsFrameworkChain.subPrograms;
                            $scope.model.piapObjectives = $scope.model.resultsFrameworkChain.objectives;
                            $scope.model.interventions = $scope.model.resultsFrameworkChain.interventions;

                            OptionComboService.getBtaDimensions().then(function( bta ){

                                if( !bta || !bta.category || !bta.options || bta.options.length !== 3 ){
                                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bta_dimensions"));
                                    return;
                                }

                                $scope.model.bta = bta;
                                $scope.model.baseLineTargetActualDimensions = $.map($scope.model.bta.options, function(d){return d.id;});
                                $scope.model.actualDimension = null;
                                $scope.model.targetDimension = null;
                                $scope.model.baselineDimension = null;
                                angular.forEach(bta.options, function(op){
                                    if ( op.dimensionType === 'actual' ){
                                        $scope.model.actualDimension = op;
                                    }
                                    if ( op.dimensionType === 'target' ){
                                        $scope.model.targetDimension = op;
                                    }
                                    if ( op.dimensionType === 'baseline' ){
                                        $scope.model.baselineDimension = op;
                                    }
                                });

                                MetaDataFactory.getAll('dataElements').then(function(dataElements){

                                    $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                                        map[obj.id] = obj;
                                        return map;
                                    }, {});

                                    MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                                        $scope.model.dataElementGroups = dataElementGroups;

                                        MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'sub-intervention').then(function(dataElementGroupSets){
                                            $scope.model.dataElementGroupSets = dataElementGroupSets;

                                            var periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                            $scope.model.allPeriods = angular.copy( periods );
                                            $scope.model.periods = periods;

                                            var selectedPeriodNames = ['2020/21', '2021/22', '2022/23', '2023/24', '2024/25'];

                                            angular.forEach($scope.model.periods, function(pe){
                                                if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                                                   $scope.model.selectedPeriods.push(pe);
                                                }
                                            });

                                            $scope.model.metaDataCached = true;
                                            $scope.populateMenu();

                                            /*$scope.model.dashboardName = 'Sub-Programme Outputs';
                                            DashboardService.getByName( $scope.model.dashboardName ).then(function( result ){
                                                $scope.model.dashboardItems = result.dashboardItems;
                                                $scope.model.charts = result.charts;
                                                $scope.model.tables = result.tables;
                                                $scope.model.maps = result.maps;
                                                $scope.model.dashboardFetched = true;
                                            });*/
                                        });
                                    });
                                });

                            });
                        });
                    });
                });
            });
        });
    });

    /*dhis2.ndp.downloadGroupSets( 'intervention' ).then(function(){

        //Get orgunits for the logged in user
        OrgUnitFactory.getViewTreeRoot().then(function(response) {
            $scope.orgUnits = response.organisationUnits;
            angular.forEach($scope.orgUnits, function(ou){
                ou.show = true;
                angular.forEach(ou.children, function(o){
                    o.hasChildren = o.children && o.children.length > 0 ? true : false;
                });
            });
            $scope.selectedOrgUnit = null;

            OrgUnitGroupSetService.getByGroup('mda').then(function(mdas){
                $scope.model.mdas = mdas;

                MetaDataFactory.getAll('legendSets').then(function(legendSets){

                    angular.forEach(legendSets, function(legendSet){
                        if ( legendSet.isTrafficLight ){
                            $scope.model.defaultLegendSet = legendSet;
                        }
                        $scope.model.legendSetsById[legendSet.id] = legendSet;
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

                        $scope.model.resultsFrameworkLevel = $filter('getFirst')($scope.model.optionSets, {code: 'RFL'});
                        if( !$scope.model.resultsFrameworkLevel || !$scope.model.resultsFrameworkLevel.code ){
                            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_results_framework_level_configuration"));
                            return;
                        }

                        $scope.model.piapResultsChain = $filter('getFirst')($scope.model.optionSets, {code: 'piapResultsChain'});
                        if( !$scope.model.piapResultsChain || !$scope.model.piapResultsChain.code || !$scope.model.piapResultsChain.options || $scope.model.piapResultsChain.options.length < 1 ){
                            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_piap_results_chain_configuration"));
                            return;
                        }

                        $scope.model.piapResultsChainByCode = $scope.model.piapResultsChain.options.reduce( function(map, obj){
                            map[obj.code] = obj;
                            return map;
                        }, {});

                        $scope.model.ndpProgrammes = $filter('filter')($scope.model.piapResultsChain.options, {resultsFrameworkLevel: 'PR'}, true);
                        $scope.model.subProgrammes = $filter('filter')($scope.model.piapResultsChain.options, {resultsFrameworkLevel: 'S'}, true);
                        $scope.model.piapObjectives = $filter('filter')($scope.model.piapResultsChain.options, {resultsFrameworkLevel: 'O'}, true);
                        $scope.model.interventions = $filter('filter')($scope.model.piapResultsChain.options, {resultsFrameworkLevel: 'IN'}, true);

                        OptionComboService.getBtaDimensions().then(function( bta ){

                            if( !bta || !bta.category || !bta.options || bta.options.length !== 3 ){
                                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bta_dimensions"));
                                return;
                            }

                            $scope.model.bta = bta;
                            $scope.model.baseLineTargetActualDimensions = $.map($scope.model.bta.options, function(d){return d.id;});
                            $scope.model.actualDimension = null;
                            $scope.model.targetDimension = null;
                            $scope.model.baselineDimension = null;
                            angular.forEach(bta.options, function(op){
                                if ( op.dimensionType === 'actual' ){
                                    $scope.model.actualDimension = op;
                                }
                                if ( op.dimensionType === 'target' ){
                                    $scope.model.targetDimension = op;
                                }
                                if ( op.dimensionType === 'baseline' ){
                                    $scope.model.baselineDimension = op;
                                }
                            });

                            MetaDataFactory.getAll('dataElements').then(function(dataElements){

                                $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                                    map[obj.id] = obj;
                                    return map;
                                }, {});


                                MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){
                                    $scope.model.dataElementGroups = dataElementGroups;

                                    MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'intervention').then(function(dataElementGroupSets){
                                        $scope.model.dataElementGroupSets = dataElementGroupSets;
                                        $scope.model.dataElementGroupSets = orderByFilter( $scope.model.dataElementGroupSets, '-displayName').reverse();

                                        var periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                        $scope.model.allPeriods = angular.copy( periods );
                                        $scope.model.periods = periods;

                                        var selectedPeriodNames = ['2020/21', '2021/22', '2022/23', '2023/24', '2024/25'];

                                        angular.forEach($scope.model.periods, function(pe){
                                            if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                                               $scope.model.selectedPeriods.push(pe);
                                            }
                                        });

                                        $scope.model.metaDataCached = true;
                                        $scope.populateMenu();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });*/

    $scope.populateMenu = function(){
        $scope.resetDataView();
        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
            $scope.model.ndpProgram = $filter('getFirst')($scope.model.optionSets, {ndp: $scope.model.selectedMenu.ndp, isNDPProgramme: true}, true);
        }
    };

    $scope.getInterventions = function(){
        $scope.model.voteDataElementGroupSets = [];
        $scope.model.objectives = [];
        $scope.model.dataElementGroup = [];
        if( $scope.model.selectedVote && $scope.model.selectedVote.dataSets.length > 0 ){
            var groupSetIds = [];
            angular.forEach($scope.model.selectedVote.dataSets,function(ds){
                angular.forEach(ds.dataSetElements,function(dse){
                    angular.forEach(dse.dataElement.dataElementGroups,function(deg){
                        angular.forEach(deg.groupSets,function(degs){
                            if(groupSetIds.indexOf(degs.id) === -1 ){
                                groupSetIds.push(degs.id);
                            }
                        });
                    });
                });
            });

            angular.forEach(groupSetIds,function(groupSetId){
                var degs = $filter('getFirst')($scope.model.dataElementGroupSets, {id: groupSetId}, true);
                if ( degs && degs.id ){
                    $scope.model.voteDataElementGroupSets.push( degs );
                }
            });
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.voteDataElementGroupSets );
            $scope.getOutputs();
        }
    };

    $scope.getOutputs = function(){
        $scope.model.dataElementGroup = [];
        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            angular.forEach(degs.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {indicatorGroupType: 'output', id: deg.id}, true);
                if ( _deg.length > 0 ){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });
        });
    };

    $scope.resetView = function(horizontalMenu){
        $scope.model.activeHorizontalMenu = horizontalMenu;
    };

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
        $scope.model.dataExists = false;
        $scope.model.dataHeaders = [];
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

    $scope.getAnalyticsData = function(){

        $scope.model.data = null;
        var analyticsUrl = '';

        var selectedResultsLevel = $scope.model.selectedNdpProgram.code;

        if ( $scope.model.selectedSubProgramme && $scope.model.selectedSubProgramme.code ){
            selectedResultsLevel = $scope.model.selectedSubProgramme.code;
        }

        if ( $scope.model.selectedObjective && $scope.model.selectedObjective.code ){
            selectedResultsLevel = $scope.model.selectedObjective.code;
        }

        if ( $scope.model.selectedIntervention && $scope.model.selectedIntervention.code ){
            selectedResultsLevel = $scope.model.selectedIntervention.code;
        }

        $scope.model.selectedDataElementGroupSets = $filter('startsWith')($scope.model.dataElementGroupSets, {code: selectedResultsLevel});
        $scope.getOutputs();

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( $scope.model.dataElementGroup.length === 0 || !$scope.model.dataElementGroup ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_output"));
            return;
        }

        $scope.getBasePeriod();

        if( $scope.model.dataElementGroup && $scope.model.dataElementGroup.length > 0 && $scope.model.selectedPeriods.length > 0){
            analyticsUrl += '&filter=ou:'+ $scope.selectedOrgUnit.id +'&displayProperty=NAME&includeMetadataDetails=true';
            analyticsUrl += '&dimension=co&dimension=' + $scope.model.bta.category + ':' + $.map($scope.model.baseLineTargetActualDimensions, function(dm){return dm;}).join(';');
            analyticsUrl += '&dimension=pe:' + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(';');

            var des = [];
            angular.forEach($scope.model.dataElementGroup, function(deg){
                des.push('DE_GROUP-' + deg.id);
            });
            analyticsUrl += '&dimension=dx:' + des.join(';');

            $scope.model.reportReady = false;
            $scope.model.reportStarted = true;
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
                        dataElementsById: $scope.model.dataElementsById,
                        cost: $scope.model.cost,
                        legendSetsById: $scope.model.legendSetsById,
                        defaultLegendSet: $scope.model.defaultLegendSet
                    };

                    var processedData = Analytics.processData( dataParams );

                    $scope.model.dataHeaders = processedData.dataHeaders;
                    $scope.model.reportPeriods = processedData.reportPeriods;
                    $scope.model.dataExists = processedData.dataExists || false;
                    $scope.model.resultData = processedData.resultData || [];
                    $scope.model.performanceData = processedData.performanceData || [];
                    $scope.model.physicalPerformanceData = processedData.physicalPerformanceData || [];
                    $scope.model.cumulativeData = processedData.cumulativeData || [];
                }
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
                    return $scope.model.mdas;
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

    $scope.filterData = function(header, dataElement){
        if(!header || !$scope.model.data || !header.periodId || !header.dimensionId || !dataElement) return;
        var res = $filter('filter')($scope.model.data, {dx: dataElement, Duw5yep8Vae: header.dimensionId, pe: header.periodId})[0];
        return res && res.value ? res.value : '';
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = $scope.model.selectedNdpProgram.displayName + " - interventions" + " .xls";
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
});