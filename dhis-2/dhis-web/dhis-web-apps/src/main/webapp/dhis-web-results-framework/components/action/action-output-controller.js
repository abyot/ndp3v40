/* Controllers */

/* global ndpFramework, dhis2 */

ndpFramework.controller('ActionOutputController',
    function($scope,
        $translate,
        $modal,
        $filter,
        DateUtils,
        orderByFilter,
        NotificationService,
        SelectedMenuService,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        OptionComboService,
        ResulstChainService,
        CommonUtils,
        DataValueService,
        ClusterDataService,
        Analytics) {

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
        objectives: [],
        ndpObjectives: [],
        ndpProgrammes: [],
        dataElementGroup: [],
        selectedDataElementGroupSets: [],
        dataElementGroups: [],
        selectedNdpProgram: null,
        selectedSubProgramme: null,
        selectedPeriods: [],
        periods: [],
        allPeriods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly',
        explanations: [],
        commentRow: {}
    };

    $scope.model.horizontalMenus = [
        {id: 'financialPerformance', title: 'financial_performance', order: 1, view: 'components/action/financial-performance.html', class: 'main-horizontal-menu'},
        //{id: 'clusterPerformance', title: 'cluster_performance', order: 2, view: 'components/action/cluster-performance.html', class: 'main-horizontal-menu'},
        {id: 'clusterPerformance', title: 'cluster_performance', order: 2, view: 'views/cluster/cluster-performance.html', class: 'main-horizontal-menu'},
        {id: 'completeness', title: 'completeness', order: 3, view: 'components/action/completeness.html', class: 'main-horizontal-menu'}
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

    $scope.getOutputs = function(){
        $scope.model.dataElementGroup = [];
        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            angular.forEach(degs.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {indicatorGroupType: 'output4action', id: deg.id}, true);
                if ( _deg.length > 0 ){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });
        });
    };

    $scope.$on('MENU', function(){
        $scope.populateMenu();
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

    dhis2.ndp.downloadGroupSets( 'sub-intervention4action' ).then(function(){

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

                    MetaDataFactory.getAll('optionGroupSets').then(function(optionGroupSets){

                        $scope.model.optionGroupSets = optionGroupSets;

                        OptionComboService.getBtaDimensions().then(function( btaResponse ){

                            if( !btaResponse || !btaResponse.bta || !btaResponse.baseline || !btaResponse.actual || !btaResponse.target ){
                                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bta_dimensions"));
                                return;
                            }

                            $scope.model.bta = btaResponse.bta;
                            $scope.model.baseLineTargetActualDimensions = $.map($scope.model.bta.options, function(d){return d.id;});
                            $scope.model.actualDimension = btaResponse.actual;
                            $scope.model.targetDimension = btaResponse.target;
                            $scope.model.baselineDimension = btaResponse.baseline;

                            OptionComboService.getBsrDimensions().then(function( bsrResponse ){

                                if( !bsrResponse || !bsrResponse.bsr || !bsrResponse.planned || !bsrResponse.approved || !bsrResponse.spent || !bsrResponse.release ){
                                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bsr_dimensions"));
                                    return;
                                }

                                $scope.model.bsr = bsrResponse.bsr;
                                $scope.model.budgetSpentReleaseDimensions = $.map($scope.model.bsr.options, function(d){return d.id;});
                                $scope.model.plannedDimension = bsrResponse.planned;
                                $scope.model.approvedDimension = bsrResponse.approved;
                                $scope.model.spentDimension = bsrResponse.spent;
                                $scope.model.releaseDimension = bsrResponse.release;

                                MetaDataFactory.getAll('dataElements').then(function(dataElements){

                                    $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                                        map[obj.id] = obj;
                                        return map;
                                    }, {});

                                    MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                                        $scope.model.dataElementGroups = dataElementGroups;

                                        MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'sub-intervention4action').then(function(dataElementGroupSets){
                                            $scope.model.dataElementGroupSets = dataElementGroupSets;

                                            var periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                            periods = periods.reverse();
                                            $scope.model.allPeriods = angular.copy( periods );
                                            $scope.model.periods = periods;

                                            var selectedPeriodNames = ['2020/21'];
                                            var today = DateUtils.getToday();
                                            $scope.model.selectedFiscalYear = '';
                                            angular.forEach($scope.model.periods, function(pe){
                                                if ( pe.startDate <= today && pe.endDate <= today ){
                                                    $scope.model.selectedFiscalYear = pe;
                                                }
                                            });

                                            if ( $scope.model.selectedFiscalYear ){
                                                selectedPeriodNames = [$scope.model.selectedFiscalYear.displayName];
                                            }

                                            angular.forEach($scope.model.periods, function(pe){
                                                if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                                                   $scope.model.selectedPeriods.push(pe);
                                                }
                                            });

                                            $scope.model.performanceOverviewLegends = CommonUtils.getPerformanceOverviewHeaders();
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
        });
    });

    $scope.populateMenu = function(){

        $scope.resetDataView();
        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        $scope.model.selectedNdpProgram = null;

        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
        }

        var sectorsOpgs = $filter('getFirst')($scope.model.optionGroupSets, {code: $scope.model.selectedMenu.ndp + '_CLUSTER'});

        $scope.model.clusters = sectorsOpgs && sectorsOpgs.optionGroups ? sectorsOpgs.optionGroups : [];
        if( !$scope.model.clusters || !$scope.model.clusters.length || !$scope.model.clusters.length === 0 ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_cluster_configuration"));
            return;
        }
    };

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
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

        $scope.model.periods = $scope.model.periods.reverse();

        $scope.model.allPeriods = angular.copy( $scope.model.periods );
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

        $scope.model.selectedDataElementGroupSets = $filter('startsWith')($scope.model.dataElementGroupSets, {code: 'SA' + selectedResultsLevel});
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

        if ( !$scope.model.basePeriod || !$scope.model.basePeriod.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_base_period"));
            return;
        }

        if( $scope.model.dataElementGroup && $scope.model.dataElementGroup.length > 0 && $scope.model.selectedPeriods.length > 0){
            analyticsUrl += '&filter=ou:'+ $scope.selectedOrgUnit.id +'&displayProperty=NAME&includeMetadataDetails=true';
            analyticsUrl += '&dimension=co&dimension=' + $scope.model.bsr.category + ':' + $.map($scope.model.budgetSpentReleaseDimensions, function(dm){return dm;}).join(';');
            analyticsUrl += '&dimension=pe:' + $.map($scope.model.selectedPeriods.concat( $scope.model.basePeriod ), function(pe){return pe.id;}).join(';');

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
                        bsr: $scope.model.bsr,
                        plannedDimension: $scope.model.plannedDimension,
                        approvedDimension: $scope.model.approvedDimension,
                        spentDimension: $scope.model.spentDimension,
                        releaseDimension: $scope.model.releaseDimension,
                        selectedDataElementGroupSets: $scope.model.selectedDataElementGroupSets,
                        selectedDataElementGroup: $scope.model.selectedKra,
                        dataElementGroups: $scope.model.dataElementGroups,
                        basePeriod: $scope.model.basePeriod,
                        maxPeriod: $scope.model.selectedPeriods.slice(-1)[0],
                        allPeriods: $scope.model.allPeriods,
                        dataElementGroupsById: $scope.model.dataElementGroupsById,
                        dataElementsById: $scope.model.dataElementsById,
                        legendSetsById: $scope.model.legendSetsById,
                        defaultLegendSet: $scope.model.defaultLegendSet,
                        displayActionBudgetData: true
                    };

                    var processedData = Analytics.processData( dataParams );

                    $scope.model.dataHeaders = processedData.dataHeaders;
                    $scope.model.reportPeriods = processedData.reportPeriods;
                    $scope.model.dataExists = processedData.dataExists;
                    $scope.model.hasPhysicalPerformanceData = processedData.hasPhysicalPerformanceData;
                    $scope.model.selectedDataElementGroupSets = processedData.selectedDataElementGroupSets;
                    $scope.model.numerator = processedData.completenessNum;
                    $scope.model.denominator = processedData.completenessDen;
                    $scope.model.dataElementRowIndex = processedData.dataElementRowIndex;
                    $scope.model.tableRows = [];
                    $scope.model.povTableRows = processedData.povTableRows;

                    angular.forEach(processedData.tableRows, function(row){
                        angular.forEach($scope.model.dataHeaders, function(dh){
                            if ( !dh.isRowData ){
                                if( !row.values || !dh || !dh.denDimensionId || !dh.periodId ){
                                    return;
                                }
                                var num = row.values[dh.numDimensionId + '.' + dh.periodId];
                                var den = row.values[dh.denDimensionId + '.' + dh.periodId];
                                var percent = CommonUtils.getPercent(num, den, true, true);
                                row.values[dh.dimensionId + '.' + dh.periodId] = percent;
                                row.styles[dh.dimensionId + '.' + dh.periodId] = CommonUtils.getTrafficColorForValue( percent );
                            }
                        });
                        $scope.model.tableRows.push( row );
                    });
                }
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

        $scope.model.clusterReportReady = false;
        $scope.model.clusterReportStarted = true;
        $scope.model.reportReady = false;
        $scope.model.reportStarted = true;

        dhis2.ndp.downloadGroupSets( 'sub-intervention4action' ).then(function(){

            MetaDataFactory.getAll('dataElements').then(function(dataElements){

                $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                    map[obj.id] = obj;
                    return map;
                }, {});

                MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                    $scope.model.allDataElementGroups = dataElementGroups;
                    $scope.model.dataElementGroups = dataElementGroups;

                    MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'sub-intervention4action').then(function(dataElementGroupSets){
                        $scope.model.dataElementGroupSets = dataElementGroupSets;

                        $scope.model.metaDataCached = true;

                        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
                            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
                        }

                        $scope.model.selectedDataElementGroupSets = angular.copy($scope.model.dataElementGroupSets);
                        $scope.getOutputs();

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
                            indicatorGroupType: 'output4action',
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
                            defaultLegendSet: $scope.model.defaultLegendSet,
                            bsr: $scope.model.bsr,
                            budgetSpentReleaseDimensions: $scope.model.budgetSpentReleaseDimensions,
                            plannedDimension: $scope.model.plannedDimension,
                            approvedDimension: $scope.model.approvedDimension,
                            spentDimension: $scope.model.spentDimension,
                            releaseDimension: $scope.model.releaseDimension,
                            displayActionBudgetData: true
                        };

                        ClusterDataService.getData( params ).then(function(result){
                            $scope.model.clusterReportReady = true;
                            $scope.model.clusterReportStarted = false;
                            $scope.model.reportReady = true;
                            $scope.model.reportStarted = false;
                            $scope.model.clusterData = result.clusterData;
                            $scope.model.hasClusterData = result.hasClusterData;
                            $scope.model.clusterPerformanceOverviewHeaders = result.clusterPerformanceOverviewHeaders;
                        });
                    });
                });
            });
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

        var reportName = $scope.model.selectedNdpProgram.displayName + " - action";

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

});