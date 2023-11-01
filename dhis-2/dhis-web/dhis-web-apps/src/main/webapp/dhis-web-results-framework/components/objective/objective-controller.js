/* Controllers */

/* global ndpFramework */


ndpFramework.controller('ObjectiveController',
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
        FinancialDataService,
        DataValueService) {

    $scope.showReportFilters = false;

    $scope.model = {
        metaDataCached: false,
        data: null,
        dataElements: [],
        dataElementsById: [],
        kra: [],
        objectives: [],
        selectedKra: null,
        selectedObjective: null,
        selectedDataElementGroupSets: [],
        dataElementGroups: [],
        baseLineTargetActualDimensions: [],
        performanceOverviewHeaders: [],
        dataSetsById: {},
        categoryCombosById: {},
        optionSets: [],
        optionSetsById: [],
        dictionaryItems: [],
        selectedPeriods: [],
        periods: [],
        allPeriods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly',
        groupSetSize: {},
        physicalPerformance: true,
        financialPerformance: true,
        showProjectDetails: false,
        showExplanation: false,
        explanations: [],
        commentRow: {}
    };

    $scope.model.horizontalMenus = [
        {id: 'target', title: 'targets', order: 1, view: 'components/objective/results.html', active: true, class: 'main-horizontal-menu'},
        {id: 'physicalPerformance', title: 'performance', order: 2, view: 'components/objective/physical-performance.html', class: 'main-horizontal-menu'},
        {id: 'performanceOverview', title: 'performance_overview', order: 3, view: 'components/objective/performance-overview.html', class: 'main-horizontal-menu'},
        {id: 'completeness', title: 'completeness', order: 4, view: 'components/objective/completeness.html', class: 'main-horizontal-menu'}
    ];

    $scope.$watch('model.selectedObjective', function(){
        $scope.model.selectedKra = null;
        $scope.model.kras = [];
        $scope.model.dataElementGroup = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedObjective) && $scope.model.selectedObjective.id){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {id: $scope.model.selectedObjective.id});
            angular.forEach($scope.model.selectedObjective.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                if ( _deg.length > 0 ){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });

            $scope.model.kras = $scope.model.selectedObjective.dataElementGroups;
        }
        else{
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
    });

    $scope.$on('MENU', function(){
        $scope.populateMenu();
    });

    $scope.$watch('model.selectedKra', function(){
        $scope.resetDataView();
        $scope.model.dataElementGroup = [];
        if( angular.isObject($scope.model.selectedKra) && $scope.model.selectedKra.id){
            var _deg = $filter('filter')($scope.model.dataElementGroups, {id: $scope.model.selectedKra.id});
            if ( _deg.length > 0 ){
                $scope.model.dataElementGroup.push( _deg[0] );
            }
            $scope.getAnalyticsData();
        }
        else{
            $scope.getObjectives();
        }
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

    $scope.getObjectives = function(){
        $scope.model.dataElementGroup = [];
        angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
            angular.forEach(degs.dataElementGroups, function(deg){
                var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id});
                if ( _deg.length > 0 ){
                    $scope.model.dataElementGroup.push( _deg[0] );
                }
            });
        });
    };

    dhis2.ndp.downloadGroupSets( 'resultsFrameworkObjective' ).then(function(){

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

                $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                    map[obj.id] = obj;
                    return map;
                }, {});

                MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){

                    $scope.model.dataElementGroups = dataElementGroups;

                    MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'resultsframeworkobjective').then(function(dataElementGroupSets){
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
                            $scope.model.metaDataCached = true;
                            $scope.populateMenu();
                            $scope.model.performanceOverviewLegends = CommonUtils.getPerformanceOverviewHeaders();
                        });
                    });
                });
            });
        });
    });

    $scope.populateMenu = function(){

        $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
        $scope.model.selectedObjective = null;
        $scope.model.selectedKra = null;
        $scope.resetDataView();

        if( $scope.model.selectedMenu && $scope.model.selectedMenu.ndp && $scope.model.selectedMenu.code ){
            $scope.model.dataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedMenu.ndp}, true);
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.dataElementGroupSets );
            if( $scope.model.dataElementGroupSets && $scope.model.dataElementGroupSets.length === 1 ){
                $scope.model.selectedObjective = $scope.model.dataElementGroupSets[0];
            }
            else{
                $scope.getObjectives();
            }
        }
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

        if( !$scope.model.dataElementGroup || $scope.model.dataElementGroup.length === 0){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_objective"));
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
            $scope.model.theRows = [];
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
                            selectedDataElementGroupSets: $scope.model.selectedDataElementGroupSets,
                            selectedDataElementGroup: $scope.model.selectedKra,
                            dataElementGroups: $scope.model.dataElementGroups,
                            basePeriod: $scope.model.basePeriod,
                            targetDimension: $scope.model.targetDimension,
                            baselineDimension: $scope.model.baselineDimension,
                            actualDimension: $scope.model.actualDimension,
                            maxPeriod: $scope.model.selectedPeriods.slice(-1)[0],
                            allPeriods: $scope.model.allPeriods,
                            dataElementGroupsById: $scope.model.dataElementGroupsById,
                            dataElementsById: $scope.model.dataElementsById,
                            cost: $scope.model.cost,
                            displayVision2040: true,
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
                        $scope.model.hasEmptyRows = processedData.tableRows.hasEmptyRows;
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
        var blob = new Blob([document.getElementById(name).innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = $scope.model.selectedMenu.displayName;

        if ( name ) {
            reportName += " - " + name;
        }

        reportName += ".xls";

        saveAs(blob, reportName);
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

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
        $scope.model.dataExists = false;
        $scope.model.dataHeaders = [];
    };

    $scope.getCoverage = function(numerator, denominator){
        return CommonUtils.getPercent(numerator, denominator, false, true);
    };

    $scope.getHeaderClass = function(header){
        return header.style;
    };
});
