/* Controllers */

/* global ndpFramework */


ndpFramework.controller('LLGController',
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
        {id: 'physicalPerformance', title: 'physical_performance', order: 1, view: 'components/llg/physical-performance.html', active: true, class: 'main-horizontal-menu'},
        //{id: 'budgetPerformance', title: 'budget_performance', order: 2, view: 'components/llg/budget-performance.html', class: 'main-horizontal-menu'},
        {id: 'financialPerformance', title: 'financial_performance', order: 2, view: 'components/llg/finance-performance.html', class: 'main-horizontal-menu'},
        {id: 'dashboard', title: 'dashboard', order: 3, view: 'components/llg/dashboard.html', class: 'main-horizontal-menu'}
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

    $scope.$watch('model.selectedNdpProgram', function(){
        $scope.model.objectives = [];
        $scope.model.subPrograms = [];
        $scope.model.selectedSubProgramme = null;
        $scope.model.selectedDataElementGroupSets = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedNdpProgram) ){
            if( $scope.model.selectedNdpProgram && $scope.model.selectedNdpProgram.code ){
                $scope.model.objectives = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp, indicatorGroupSetType: $scope.model.selectedMenu.code, ndpProgramme: $scope.model.selectedNdpProgram.code}, true);
                $scope.model.subPrograms = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp, indicatorGroupSetType: 'sub-programme', ndpProgramme: $scope.model.selectedNdpProgram.code}, true);
                $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.objectives );
            }
        }
    });

    $scope.$watch('model.selectedObjective', function(){
        $scope.model.dataElementGroup = [];
        $scope.resetDataView();
        $scope.model.selectedIntervention = null;
        if( $scope.model.selectedObjective ){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {programObjective: $scope.model.selectedObjective});
            angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
                });
            });
        }
        else{
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.interventions );
            angular.forEach($scope.model.interventions, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
                });
            });
        }
    });

    $scope.$watch('model.selectedIntervention', function(){
        $scope.model.dataElementGroup = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedIntervention) && $scope.model.selectedIntervention.id){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {id: $scope.model.selectedIntervention.id});
            angular.forEach($scope.model.selectedIntervention.dataElementGroups, function(deg){
                $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
            });
        }
        else{
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.interventions );
            angular.forEach($scope.model.interventions, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
                });
            });
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
        $scope.selectedOrgUnit = null;

        OrgUnitGroupSetService.getByGroup('llg').then(function(llgs){
            $scope.model.llgs = llgs;

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

                                MetaDataFactory.getAll('dataElementGroupSets').then(function(dataElementGroupSets){

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
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    $scope.populateMenu = function(){
        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp ){
            $scope.model.selectedNDP = $filter('getFirst')($scope.model.ndp.options, {code: $scope.model.selectedMenu.ndp});
        }
    };

    $scope.getObjectives = function(){
        $scope.model.objectives = [];
        $scope.model.dataElementGroup = [];
        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            if ( degs.programObjective && $scope.model.objectives.indexOf(degs.programObjective) === -1 ){
                $scope.model.objectives.push( degs.programObjective );
            }
            angular.forEach(degs.dataElementGroups, function(deg){
                $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
            });
        });
    };

    $scope.getInterventions = function(){
        $scope.model.selectedDataElementGroupSets = [];
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
                $scope.model.selectedDataElementGroupSets.push( $filter('filter')($scope.model.dataElementGroupSets, {id: groupSetId})[0] );
            });

            if( $scope.model.selectedNDP && $scope.model.selectedNDP.code ){
                $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.selectedDataElementGroupSets, {indicatorGroupSetType: 'intervention', ndp: $scope.model.selectedNDP.code}, true);
            }
            else{
                $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.selectedDataElementGroupSets, {indicatorGroupSetType: 'intervention'}, true);
            }

            $scope.getOutputs();
        }
    };

    $scope.getOutputs = function(){
        $scope.model.selectedDataElementGroupSets = $scope.model.selectedDataElementGroupSets.filter(function(obj){
            return obj.dataElementGroups && obj.dataElementGroups.length && obj.dataElementGroups.length > 0;
        });

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

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
        }

        if( $scope.model.dataElementGroup.length === 0 || !$scope.model.dataElementGroup ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_invervention"));
        }

        $scope.getBasePeriod();

        if ( !$scope.model.basePeriod || !$scope.model.basePeriod.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_base_period"));
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
                    return $scope.model.llgs;
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