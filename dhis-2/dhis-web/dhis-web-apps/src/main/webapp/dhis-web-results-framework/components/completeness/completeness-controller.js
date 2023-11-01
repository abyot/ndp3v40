/* global angular, dhis2, ndpFramework */

'use strict';

//Controller for settings page
ndpFramework.controller('CompletenessController',
        function($scope,
                $modal,
                $filter,
                $translate,
                orderByFilter,
                PeriodService,
                OrgUnitFactory,
                MetaDataFactory,
                NotificationService,
                OptionComboService,
                CommonUtils,
                Analytics) {

    $scope.model = {
        metaDataCached: false,
        dataElementGroups: [],
        dataElementGroupSets: [],
        optionSets: [],
        optionSetsById: [],
        objectives: [],
        ndp: null,
        programs: [],
        selectedNdp: null,
        selectedProgram: null,
        periods: [],
        selectedPeriods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly'
    };

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

    $scope.$watch('model.selectedNDP', function(){
        $scope.model.selectedDataElementGroupSets = [];
        $scope.model.dataElementGroup = [];
        $scope.model.selectedProgram = null;
        $scope.model.objectives = [];
        if( angular.isObject($scope.model.selectedNDP) && $scope.model.selectedNDP.id && $scope.model.selectedNDP.code){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedNDP.code, indicatorGroupSetType: 'program'}, true);
            $scope.model.ndpProgram = $filter('filter')($scope.model.optionSets, {ndp: $scope.model.selectedNDP.code, isNDPProgramme: true}, true)[0];
        }
    });

    $scope.$watch('model.selectedProgram', function(){
        $scope.model.dataElementGroup = [];
        $scope.model.objectives = [];
        $scope.model.selectedDataElementGroupSets = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.code){
            $scope.model.objectives = $filter('filter')($scope.model.dataElementGroupSets, {ndp: $scope.model.selectedNDP.code, indicatorGroupSetType: 'objective', ndpProgramme: $scope.model.selectedProgram.code}, true);
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.objectives );
            angular.forEach($scope.model.objectives, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
                });
            });
        }
    });

    $scope.$watch('model.selectedObjective', function(){
        $scope.model.dataElementGroup = [];
        $scope.resetDataView();
        if( angular.isObject($scope.model.selectedObjective) && $scope.model.selectedObjective.id){
            $scope.model.selectedDataElementGroupSets = $filter('filter')($scope.model.dataElementGroupSets, {id: $scope.model.selectedObjective.id});
            angular.forEach($scope.model.selectedObjective.dataElementGroups, function(deg){
                $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
            });
        }
        else{
            $scope.model.selectedDataElementGroupSets = angular.copy( $scope.model.objectives );
            angular.forEach($scope.model.objectives, function(degs){
                angular.forEach(degs.dataElementGroups, function(deg){
                    $scope.model.dataElementGroup.push( $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0] );
                });
            });
        }
    });

    dhis2.ndp.downloadGroupSets( 'objective' ).then(function(){

        MetaDataFactory.getAll('optionSets').then(function(optionSets){

            $scope.model.optionSets = optionSets;

            angular.forEach(optionSets, function(optionSet){
                $scope.model.optionSetsById[optionSet.id] = optionSet;
            });


            OptionComboService.getBtaDimensions().then(function( bta ){

                if( !bta || !bta.category || !bta.options || bta.options.length !== 3 ){
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_bta_dimensions"));
                    return;
                }

                $scope.model.bta = bta;
                $scope.model.baseLineTargetActualDimensions = $.map($scope.model.bta.options, function(d){return d.id;});

                MetaDataFactory.getAll('dataElementGroupSets').then(function( dataElementGroupSets ){
                    $scope.model.dataElementGroupSets = dataElementGroupSets;

                    MetaDataFactory.getDataElementGroups().then(function(dataElementGroups){
                        $scope.model.dataElementGroups = dataElementGroups;

                        $scope.model.periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);

                        var selectedPeriodNames = ['2020/21', '2021/22', '2022/23', '2023/24', '2024/25'];

                        angular.forEach($scope.model.periods, function(pe){
                            if(selectedPeriodNames.indexOf(pe.displayName) > -1 ){
                               $scope.model.selectedPeriods.push(pe);
                            }
                        });

                        $scope.model.ndp = $filter('filter')($scope.model.optionSets, {code: 'ndp'})[0];
                    });
                });
            });
        });
    }, function(){
        console.log('error');
    });

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

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
        $scope.model.dataExists = false;
        $scope.model.dataHeaders = [];
    };

    $scope.getCompleteness = function(){

        if( !$scope.model.selectedNDP ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_ndp"));
            return;
        }

        if( !$scope.model.selectedProgram ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_programme"));
            return;
        }

        if( !$scope.model.dataElementGroup || $scope.model.dataElementGroup.length === 0 ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("program_missing_objective"));
            return;
        }

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( !$scope.model.selectedPeriods || !$scope.model.selectedPeriods.length === 0 ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_period"));
            return;
        }

        $scope.model.data = null;
        var analyticsUrl = '';

        analyticsUrl += '&filter=ou:'+ $scope.selectedOrgUnit.id +'&displayProperty=NAME&includeMetadataDetails=true';
        analyticsUrl += '&dimension=' + $scope.model.bta.category + ':' + $.map($scope.model.baseLineTargetActualDimensions, function(dm){return dm;}).join(';');
        analyticsUrl += '&dimension=pe:' + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(';');

        var des = [];
        angular.forEach($scope.model.dataElementGroup, function(deg){
            angular.forEach(deg.dataElements, function(de){
                des.push( de.id );
            });
        });

        analyticsUrl += '&dimension=dx:' + des.join(';');

        Analytics.getData( analyticsUrl ).then(function(data){
            $scope.model.selectedPeriods = orderByFilter( $scope.model.selectedPeriods, '-id').reverse();
            $scope.model.data = data.data;
            $scope.model.metaData = data.metaData;
            $scope.model.reportReady = true;
            $scope.model.reportStarted = false;
            $scope.model.dataHeaders = [];
            angular.forEach($scope.model.selectedPeriods, function(pe){
                var colSpan = 0;
                var d = $filter('filter')($scope.model.data, {pe: pe.id});
                pe.hasData = d && d.length > 0;
                angular.forEach($scope.model.baseLineTargetActualDimensions, function(dm){
                    var filterParams = {pe: pe.id};
                    filterParams[$scope.model.bta.category] = dm;
                    var d = $filter('dataFilter')($scope.model.data, filterParams);
                    if( d && d.length > 0 ){
                        colSpan++;
                        $scope.model.dataHeaders.push({periodId: pe.id, dimensionId: dm, dimension: $scope.model.bta.category});
                    }
                });
                pe.colSpan = colSpan;
            });

            if( Object.keys( $scope.model.data ).length === 0 ){
                $scope.model.dataExists = false;
                return;
            }
            else{
                $scope.model.dataExists = true;
                $scope.model.numerator = 0;
                $scope.model.denominator = 0;
                angular.forEach($scope.model.selectedDataElementGroupSets, function(degs){
                    degs.expected = {};
                    degs.available = {};
                    angular.forEach(degs.dataElementGroups, function(deg){
                        var _deg = $filter('filter')($scope.model.dataElementGroups, {id: deg.id})[0];
                        angular.forEach(_deg.dataElements, function(de){
                            angular.forEach($scope.model.dataHeaders, function(dh){
                                var id = [dh.periodId, dh.dimensionId].join('-');
                                if ( !degs.available[id] ){
                                    degs.available[id] = 0;
                                }
                                if ( !degs.expected[id] ){
                                    degs.expected[id] = 0;
                                }

                                degs.expected[id]++;
                                $scope.model.denominator++;
                                if( $scope.valueExists(dh, de.id) ){
                                    degs.available[id]++;
                                    $scope.model.numerator++;
                                }
                            });
                        });
                    });
                });
            }
        });
    };

    $scope.valueExists = function(header, dataElement){
        if(!header || !$scope.model.data || !header.periodId || !header.dimensionId || !dataElement) {
            return false;
        }
        var filterParams = {
            dx: dataElement,
            pe: header.periodId
        };

        filterParams[$scope.model.bta.category] = header.dimensionId;
        var res = $filter('dataFilter')($scope.model.data, filterParams)[0];
        return res && res.value ? true : false;
    };

    $scope.getCoverage = function(numerator, denominator){
        return CommonUtils.getPercent(numerator, denominator, false, true);
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = "Completeness" + " .xls";
        if( name ){
            reportName = name + ' completeness.xls';
        }
        saveAs(blob, reportName);
    };

});
